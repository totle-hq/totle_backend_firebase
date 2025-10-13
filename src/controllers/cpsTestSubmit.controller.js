// src/controllers/cpsTestSubmit.controller.js
import {
  CpsTestSession,
  CpsTestResponse,
  CpsQuestionBank,
  CpsRubricMapping,
  CpsUserQuestionLog,
} from "../Models/Cps/index.js";

import { CpsProfile } from "../Models/CpsProfile.model.js";
import { cpsEmit } from "../events/cpsGeneratorEvents.js";
import { aggregateAndUpsertCpsProfile } from "../services/cpsScoreAggregator.service.js";

/**
 * POST /api/cps/submit-iq-test
 * Body:
 * {
 *   userId: string,
 *   batch_id: number,
 *   generation_batch_key: string,
 *   responses: [{ question_id, chosen_option, confidence, time_spent_ms }]
 * }
 */
export async function submitIQTestController(req, res) {
  const t0 = Date.now();
  try {
    const { userId, batch_id, generation_batch_key, responses } = req.body;
    if (!userId || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ ok: false, error: "Invalid request body." });
    }

    // 1️⃣ Create test session
    const session = await CpsTestSession.create({
      user_id: userId,
      batch_id,
      generation_batch_key,
      started_at: new Date(t0),
      status: "started",
    });

    // 2️⃣ Insert all responses
    const session_id = session.id;
    const mapped = responses.map((r) => ({
      session_id,
      question_id: r.question_id,
      chosen_option: r.chosen_option,
      confidence: r.confidence ?? null,
      time_spent_ms: r.time_spent_ms ?? null,
    }));
    await CpsTestResponse.bulkCreate(mapped, { returning: false });

    // 3️⃣ Insert or update into user-question log for CPS aggregator
    for (const r of responses) {
      const q = await CpsQuestionBank.findByPk(r.question_id, {
        attributes: ["correct_option"],
      });
      const is_correct = q ? q.correct_option === r.chosen_option : false;

      await CpsUserQuestionLog.upsert({
        user_id: userId,
        question_id: r.question_id,
        batch_id,
        is_correct,
        confidence: r.confidence ?? null,
        time_spent_ms: r.time_spent_ms ?? null,
      });
    }

    // 4️⃣ Compute and persist CPS Profile (IQ context)
    await aggregateAndUpsertCpsProfile({
      userId,
      context_type: "IQ",
      context_ref_id: null,
    });

    // 5️⃣ Mark session as completed
    await session.update({ completed_at: new Date(), status: "completed" });

    // 6️⃣ Emit socket event for dashboards
    cpsEmit.completed({
      userId,
      batch_id,
      generation_batch_key,
    });

    return res.status(200).json({
      ok: true,
      message: "IQ Test submitted successfully.",
    });
  } catch (err) {
    console.error("❌ [CPS] IQ Test submission failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error during IQ Test submission.",
    });
  }
}
