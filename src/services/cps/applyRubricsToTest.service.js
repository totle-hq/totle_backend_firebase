import { Test } from "../../Models/test.model.js";
import { TestItemRubric } from "../../Models/TestItemRubric.model.js";
import { CPS_KEYS } from "./cpsKeys.js";

/**
 * Apply rubrics for a submitted test:
 * - Join Test.answers_submitted with TestItemRubric
 * - For each item, look up learner's chosen option → option_impacts
 * - Aggregate impacts into param-level deltas (−1..+1 scale per key)
 * - Normalize shorthand keys to stable CPS_KEYS
 * - Convert to 0..100 scale
 * - Persist into Test.performance_metrics.param_deltas
 * - Return { deltas, gates, summary }
 *
 * NOTE:
 *   This service DOES NOT persist to CpsProfile.
 *   You must call updateCpsProfileFromTest() after this to apply EMA + persistence.
 */

/* ------------------ Key normalization ------------------ */
const normalizeKey = (k) => {
  switch (k) {
    // Old shorthand → stable CPS keys
    case "memory_retrieval": return "recall_fidelity";   // retrieval → fidelity
    case "reasoning_strategy": return "pattern_recognition"; // strategy → recognition
    case "metacognition_selfreg": return "strategy_selection_score"; // selfreg → strategy selection
    case "speed_fluency": return "adaptive_fluency_index"; // fluency shorthand
    case "attention_focus": return "active_engagement_ratio"; // focus shorthand
    case "resilience": return "resilience_rebound"; // resilience shorthand
    default: return k;
  }
};

/* ------------------ Main ------------------ */
export async function applyRubricsToTest(testId, { transaction } = {}) {
  if (!testId) throw new Error("applyRubricsToTest: testId is required");

  // 1) Load test row
  const test = await Test.findByPk(testId, { transaction });
  if (!test) throw new Error(`Test ${testId} not found`);
  if (!test.answers_submitted) {
    throw new Error(`Test ${testId} has no submitted answers`);
  }

  const submittedAnswers = test.answers_submitted;
  const answers = Array.isArray(test.answers) ? test.answers : [];
  const answerMap = {};
  for (const a of answers) {
    answerMap[String(a.id)] = String(a.correct_answer || "").toUpperCase();
  }

  // 2) Load rubrics
  const rubrics = await TestItemRubric.findAll({
    where: { test_id: testId },
    transaction,
  });

  // 🔍 DEBUG
  // console.log("🟢 Loaded rubrics count:", rubrics.length);

  // 3) Aggregate param deltas
  const totals = {}; // { param: { sum, count } }
  let teachingGateFail = false;
  let resilienceReboundOK = false;

  for (const r of rubrics) {
    const qid = String(r.global_qid);
    const blockKey = r.block_key;
    const learnerAns = String(submittedAnswers[qid] || "").toUpperCase();
    const correctAns = answerMap[qid] || "";
    const isCorrect = learnerAns === correctAns;

    const gates = r.gates || {};
    const itemWeight = Number(r.item_weight ?? 1) || 1;

    const impacts = r.option_impacts?.[learnerAns] || {};

    // 🔍 DEBUG
    console.log("🔍 QID", qid, { learnerAns, correctAns, impacts });

    for (const [param, delta] of Object.entries(impacts)) {
      const stableKey = normalizeKey(param);
      const val = Number(delta);
      if (!Number.isFinite(val)) continue;

      if (!totals[stableKey]) totals[stableKey] = { sum: 0, count: 0 };
      totals[stableKey].sum += val * itemWeight;
      totals[stableKey].count += itemWeight;
    }

    // ✅ Gates handling (default PASS unless explicit fail)
    if (blockKey === "teaching") {
      if (gates.teaching_floor || gates.unsafe) {
        teachingGateFail = true;
      }
    }
    if (blockKey === "resilience_adaptability" && isCorrect) {
      resilienceReboundOK = true;
    }
  }

  // 4) Normalize into 0..100 scores — include ALL CPS_KEYS
  const deltas = {};
  for (const key of CPS_KEYS) {
    if (totals[key]) {
      const { sum, count } = totals[key];
      const avg = count > 0 ? sum / count : 0;
      const scaled = Math.round((avg + 1) * 50); // −1..+1 → 0..100
      deltas[key] = Math.max(0, Math.min(100, scaled));
    } else {
      // Key never appeared in rubrics → set to 0 by contract
      deltas[key] = 0;
    }
  }

  // 4b) Include teacher_score if present in totals
  if (totals.teacher_score) {
    const { sum, count } = totals.teacher_score;
    const avg = count > 0 ? sum / count : 0;
    const scaled = Math.round((avg + 1) * 50); // −1..+1 → 0..100
    deltas.teacher_score = Math.max(0, Math.min(100, scaled));
  }


  // 🔍 DEBUG
  // console.log("✅ Final deltas for test", testId, deltas);
  // console.log("✅ Gates summary:", {
  //   teachingGateFail,
  //   resilienceReboundOK,
  // });

  // 5) Persist into performance_metrics
  const perf = { ...(test.performance_metrics || {}) };
  perf.param_deltas = deltas;
  await test.update({ performance_metrics: perf }, { transaction });

  // 6) Return result
  return {
    deltas,
    gates: {
      teachingGatePassed: !teachingGateFail,
      resilienceGatePassed: resilienceReboundOK,
    },
    summary: {
      totalQuestions: answers.length,
      attempted: Object.keys(submittedAnswers).length,
      updatedParams: Object.keys(deltas).length,
    },
  };
}
