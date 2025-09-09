import { sequelize1 } from "../../config/sequelize.js";
import { Test } from "../../Models/test.model.js";
import { CpsProfile } from "../../Models/CpsProfile.model.js";
import { CPS_KEYS } from "./cpsKeys.js";

/* ---------------------------- Utility helpers ---------------------------- */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp100 = (x) => Math.max(0, Math.min(100, x));
const asNum = (v) => (v === null || v === undefined ? undefined : Number(v));

/**
 * Pick CPS deltas from explicit args or from test row
 */
function pickCpsDeltas({ deltas, test }) {
  if (deltas && typeof deltas === "object" && Object.keys(deltas).length > 0) {
    return deltas;
  }
  if (test?.performance_metrics?.param_deltas) {
    return test.performance_metrics.param_deltas;
  }
  if (test?.performance_metrics?.cps_scores) {
    return test.performance_metrics.cps_scores;
  }
  if (test?.result?.cps_scores) {
    return test.result.cps_scores;
  }
  return {};
}

/* ---------------------- Exponential Moving Average ----------------------- */
/**
 * Update CPS profile from one evaluated test.
 * - If first test, baseline = deltas.
 * - Otherwise EMA: new = (1 - α) * old + α * latest.
 * - Always iterates across ALL CPS_KEYS, defaulting missing ones to 0.
 * - Writes back into cps_profiles table.
 * - Marks update metadata into test.result.cps_ema.
 */
export async function updateCpsProfileFromTest({
  testId,
  userId,
  deltas,                   // 👈 direct deltas (preferred)
  alpha = 0.4,
  firstTestSetsBaseline = true,
} = {}) {
  if (!testId) throw new Error("updateCpsProfileFromTest: testId is required");
  const effAlpha = clamp01(alpha);

  return sequelize1.transaction(async (t) => {
    // Load test
    const test = await Test.findByPk(testId, { transaction: t });
    if (!test) throw new Error(`Test ${testId} not found`);

    const uid = userId || test.user_id;
    if (!uid) throw new Error("Cannot resolve user_id for CPS update");

    const incoming = pickCpsDeltas({ deltas, test });

    // 🔑 DEBUG
    console.log("🔍 EMA incoming deltas for user", uid, "test", testId, "→", incoming);

    // Ensure profile row exists
    const [profile] = await CpsProfile.findOrCreate({
      where: { user_id: uid },
      defaults: { user_id: uid, tests_seen: 0 },
      transaction: t,
    });

    const testsSeen = Number(profile.tests_seen || 0);
    const updated = {};
    let updatedCount = 0;

    // ✅ Iterate over ALL CPS_KEYS
    for (const key of CPS_KEYS) {
      const latestRaw = asNum(incoming[key]);
      const latest = Number.isFinite(latestRaw) ? clamp100(latestRaw) : 0;

      const prev = asNum(profile[key]);
      if (testsSeen === 0 && firstTestSetsBaseline) {
        // First test sets baseline
        updated[key] = latest;
      } else {
        // EMA smoothing
        const base = Number.isFinite(prev) ? Number(prev) : 0;
        const ema = (1 - effAlpha) * base + effAlpha * latest;
        updated[key] = clamp100(ema);
      }
      updatedCount++;
    }

    const nextSeen = testsSeen + 1;

    // 🔑 DEBUG
    console.log("✅ EMA updating profile for user", uid, "→", updatedCount, "keys updated");

    await profile.update(
      { ...updated, tests_seen: nextSeen, last_test_id: test.test_id },
      { transaction: t }
    );

    // Mark metadata on test.result for traceability
    const result = { ...(test.result || {}) };
    result.cps_ema = {
      applied: true,
      alpha: effAlpha,
      tests_seen_before: testsSeen,
      tests_seen_after: nextSeen,
      updated_keys: updatedCount,
      applied_at: new Date().toISOString(),
    };
    await test.update({ result }, { transaction: t });

    return {
      applied: true,
      user_id: uid,
      test_id: test.test_id,
      alpha: effAlpha,
      tests_seen_before: testsSeen,
      tests_seen_after: nextSeen,
      updated_keys: updatedCount,
    };
  });
}

/* ---------------------- Pure utility (per-param EMA) --------------------- */
export function ema(prev, latest, alpha = 0.4) {
  const A = clamp01(alpha);
  if (!Number.isFinite(prev)) return clamp100(latest);
  return clamp100((1 - A) * prev + A * latest);
}
