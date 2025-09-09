// src/services/tests/attemptGuards.service.js
import { Op } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";
import { Test } from "../../Models/test.model.js";
import { Payment } from "../../Models/PaymentModels.js";

/**
 * Small helper to add whole days to a JS Date
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d;
}

/**
 * Read the latest finished test for a user+topic (has submitted_at).
 */
async function getLastSubmittedTest(userId, topicId, tx) {
  return Test.findOne({
    where: {
      user_id: userId,
      topic_uuid: topicId,
      submitted_at: { [Op.ne]: null },
    },
    order: [["submitted_at", "DESC"]],
    transaction: tx,
  });
}

/**
 * Throws an Error with .code and .meta (safe to JSON) for controller to handle.
 */
function fail(code, message, meta = {}) {
  const err = new Error(message || code);
  err.code = code;
  err.meta = meta;
  return err;
}

/**
 * Guard before starting a test generation:
 * - Verifies the payment exists and belongs to the user
 * - Enforces one-payment-one-test (no reuse)
 * - Enforces cooling period based on the latest submitted attempt for this topic
 *
 * Returns a descriptor your controller can use to branch prompt logic:
 *   { ok: true, firstAttempt: boolean, cooldown: { active, nextAvailableAt, remainingMs }, lastTest }
 *
 * Usage (in your start-test endpoint BEFORE contacting LLM):
 *   const gate = await assertCanStartTest({ userId, topicId, paymentId });
 *   // if ok, proceed; if it throws, return 4xx with err.code and err.meta
 */
export async function assertCanStartTest({
  userId,
  topicId,
  paymentId,
  defaultCoolingDays = 0, // optional global fallback if last test has null cooling_period
}) {
  if (!userId) throw fail("BAD_REQUEST", "userId required");
  if (!topicId) throw fail("BAD_REQUEST", "topicId required");
  if (!paymentId) throw fail("BAD_REQUEST", "paymentId required");

  return sequelize1.transaction(
    { isolationLevel: "READ COMMITTED" },
    async (t) => {
      // 1) Payment must exist and belong to user
      const pay = await Payment.findOne({
        where: { payment_id: paymentId },
        transaction: t,
      });

      if (!pay) {
        throw fail("PAYMENT_NOT_FOUND", "Payment record not found", {
          paymentId,
        });
      }
      if (String(pay.user_id) !== String(userId)) {
        throw fail(
          "PAYMENT_NOT_OWNED",
          "Payment does not belong to this user",
          { paymentId, paymentUserId: pay.user_id, userId }
        );
      }

      // 2) Enforce one-payment-one-test (also backed by unique index on Test.payment_id)
      const existing = await Test.findOne({
        where: { payment_id: paymentId },
        transaction: t,
      });
      if (existing) {
        throw fail("PAYMENT_ALREADY_USED", "This payment is already tied to a test", {
          paymentId,
          testId: existing.test_id,
        });
      }

      // 3) Cooling period gate — check latest submitted test for this user+topic
      const last = await getLastSubmittedTest(userId, topicId, t);
      let cooling = { active: false, nextAvailableAt: null, remainingMs: 0 };

      if (last?.submitted_at) {
        const days = Number.isFinite(Number(last.cooling_period))
          ? Number(last.cooling_period)
          : Number(defaultCoolingDays || 0);

        if (days > 0) {
          const nextAt = addDays(last.submitted_at, days);
          const now = new Date();
          if (now < nextAt) {
            cooling = {
              active: true,
              nextAvailableAt: nextAt,
              remainingMs: nextAt.getTime() - now.getTime(),
            };
            throw fail("COOLDOWN_ACTIVE", "Cooling period in effect", {
              topicId,
              lastTestId: last.test_id,
              submittedAt: last.submitted_at,
              coolingDays: days,
              nextAvailableAt: nextAt,
              remainingMs: cooling.remainingMs,
            });
          }
        }
      }

      const firstAttempt = !last; // no submitted attempts yet for this topic

      return {
        ok: true,
        firstAttempt,
        cooldown: cooling,
        lastTest: last ? {
          test_id: last.test_id,
          submitted_at: last.submitted_at,
          cooling_period: last.cooling_period,
          status: last.status,
        } : null,
      };
    }
  );
}
