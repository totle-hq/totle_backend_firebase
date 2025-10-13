// src/services/cpsScoreAggregator.service.js
// ------------------------------------------------------------
// Purpose: Aggregate user IQ test responses and update CPS profile dynamically
// ------------------------------------------------------------

import { randomUUID } from "crypto";
import { CpsRubricMapping, CpsUserQuestionLog } from "../Models/Cps/index.js";
import { sequelize1 } from "../config/sequelize.js";

/**
 * Aggregates all user responses, computes per-parameter CPS metrics,
 * and updates the corresponding CPS profile safely (0–100 scaled values).
 */
export async function aggregateAndUpsertCpsProfile({
  userId,
  context_type = "IQ",
  context_ref_id = null,
}) {
  const trx = await sequelize1.transaction();

  try {
    // 1️⃣ Fetch all user responses
    const responses = await CpsUserQuestionLog.findAll({
      where: { user_id: userId },
      attributes: ["question_id", "is_correct", "confidence", "time_spent_ms"],
      raw: true,
    });

    if (!responses.length) {
      await trx.rollback();
      console.warn(`[CPS] No responses found for user ${userId}`);
      return false;
    }

    // 2️⃣ Fetch rubrics for these questions
    const questionIds = responses.map((r) => r.question_id);
    const rubrics = await CpsRubricMapping.findAll({
      where: { question_id: questionIds },
      attributes: ["question_id", "parameter_name", "weight"],
      raw: true,
    });

    // 3️⃣ Aggregate weighted scores per parameter
    const totals = {};
    const weights = {};

    for (const r of responses) {
      const linkedRubrics = rubrics.filter((x) => x.question_id === r.question_id);
      for (const rr of linkedRubrics) {
        const param = rr.parameter_name.toLowerCase();
        const weight = Number(rr.weight) || 0;
        const score = r.is_correct ? 1 : 0;

        totals[param] = (totals[param] || 0) + score * weight;
        weights[param] = (weights[param] || 0) + weight;
      }
    }

    // 4️⃣ Compute normalized scores (0–1)
    const paramScores = {};
    for (const [param, total] of Object.entries(totals)) {
      paramScores[param] = Number((total / (weights[param] || 1)).toFixed(4));
    }

    // 5️⃣ Convert to 0–100 scale
    const scaledScores = {};
    for (const [param, val] of Object.entries(paramScores)) {
      scaledScores[param] = Math.round(val * 100);
    }

    // 6️⃣ Map rubric parameters → official CPS model columns
    const paramMapping = {
      // Reasoning & Strategy
      logical_reasoning: "pattern_recognition",
      deductive_reasoning: "deductive_strength",
      critical_thinking: "problem_decomposition",
      comprehension: "abstraction_capacity",
      categorical_reasoning: "rule_inference",
      categorization: "strategy_shift",
      creativity: "innovation",
      divergent_thinking: "flexibility",
      problem_solving: "tactical_depth",

      // Memory & Retrieval
      recall: "recall_fidelity",
      memory_retention: "retention_curve",
      memorization: "recall_fidelity",
      recognition: "recognition_bias",
      spaced_recall_effectiveness: "spaced_recall_effectiveness",
      interference_resistance: "interference_resistance",
      episodic_memory_flag: "episodic_memory_flag",

      // Processing & Fluency
      mean_response_time: "mean_response_time",
      speed_accuracy_tradeoff: "speed_accuracy_tradeoff",
      adaptive_fluency_index: "adaptive_fluency_index",
      cognitive_load_tolerance: "cognitive_load_tolerance",
      reaction_variability: "reaction_variability",
      decision_latency: "decision_latency",
      fluency_recovery_rate: "fluency_recovery_rate",

      // Attention & Focus
      attention: "active_engagement_ratio",
      attention_management: "attention_management",
      question_skipping_rate: "question_skipping_rate",
      hover_depth_index: "hover_depth_index",
      backtracking_frequency: "backtracking_frequency",
      attention_recovery_rate: "attention_recovery_rate",
      focus_decay_over_time: "focus_decay_over_time",

      // Metacognition & Regulation
      strategy_selection_score: "strategy_selection_score",
      self_correction_rate: "self_correction_rate",
      hint_utilization_efficiency: "hint_utilization_efficiency",
      planning_latency: "planning_latency",
      reflective_comment_depth: "reflective_comment_depth",
      retry_strategy_shift: "retry_strategy_shift",
      time_reallocation_efficiency: "time_reallocation_efficiency",
      goal_alignment_flag: "goal_alignment_flag",

      // Resilience & Adaptability
      persistence_score: "persistence_score",
      resilience_rebound: "resilience_rebound",
      frustration_threshold: "frustration_threshold",
      effort_variability: "effort_variability",
      strategy_adaptability: "strategy_adaptability",
      grit_trajectory: "grit_trajectory",
      recovery_latency: "recovery_latency",
      plateau_breaking_score: "plateau_breaking_score",
    };

    const normalizedPayload = {};
    for (const [key, val] of Object.entries(scaledScores)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s&/\\-]+/g, "_");
      const dbKey = paramMapping[cleanKey] || cleanKey;
      normalizedPayload[dbKey] = val;
    }

    // 7️⃣ Compute 6 Dimension Averages
    const dimensionGroups = {
      reasoning_strategy: [
        "pattern_recognition",
        "deductive_strength",
        "problem_decomposition",
        "abstraction_capacity",
        "rule_inference",
        "strategy_shift",
        "tactical_depth",
      ],
      memory_retrieval: [
        "retention_curve",
        "recall_fidelity",
        "recognition_bias",
        "spaced_recall_effectiveness",
        "memory_decay_rate",
        "episodic_memory_flag",
      ],
      processing_fluency: [
        "mean_response_time",
        "speed_accuracy_tradeoff",
        "adaptive_fluency_index",
        "cognitive_load_tolerance",
        "reaction_variability",
        "decision_latency",
        "fluency_recovery_rate",
      ],
      attention_focus: [
        "active_engagement_ratio",
        "tab_switch_frequency",
        "question_skipping_rate",
        "hover_depth_index",
        "backtracking_frequency",
        "attention_recovery_rate",
        "focus_decay_over_time",
      ],
      metacognition_regulation: [
        "strategy_selection_score",
        "self_correction_rate",
        "hint_utilization_efficiency",
        "planning_latency",
        "reflective_comment_depth",
        "retry_strategy_shift",
        "time_reallocation_efficiency",
        "goal_alignment_flag",
      ],
      resilience_adaptability: [
        "persistence_score",
        "resilience_rebound",
        "frustration_threshold",
        "effort_variability",
        "strategy_adaptability",
        "grit_trajectory",
        "recovery_latency",
        "plateau_breaking_score",
      ],
    };

    const dimensionAverages = {};
    for (const [dim, keys] of Object.entries(dimensionGroups)) {
      const values = keys.map((k) => normalizedPayload[k]).filter((v) => v !== undefined);
      dimensionAverages[dim] =
        values.length > 0
          ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
          : 0;
    }

    // Merge all into one payload
    normalizedPayload.overall_score =
      Object.values(dimensionAverages).reduce((a, b) => a + b, 0) /
      Object.values(dimensionAverages).length;
    Object.assign(normalizedPayload, dimensionAverages);

    // 8️⃣ Filter to valid DB columns and UPSERT
    const id = randomUUID();
    const now = new Date();

    const [existingColsResult] = await sequelize1.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'cps' AND table_name = 'cps_profiles';
    `);
    const validCols = existingColsResult.map((r) => r.column_name);

    const filteredPayload = {};
    for (const [key, val] of Object.entries(normalizedPayload)) {
      if (validCols.includes(key)) filteredPayload[key] = val;
      else console.warn(`[CPS] Skipping unmapped or invalid column: ${key}`);
    }

    filteredPayload.created_at = now;
    filteredPayload.updated_at = now;

    const cols = Object.keys(filteredPayload);
    const bindValues = Object.values(filteredPayload);

    const colNames = cols.map((c) => `"${c}"`).join(", ");
    const valPlaceholders = bindValues.map((_, i) => `$${i + 4}`).join(", ");
    const setClause = [
      ...Object.keys(filteredPayload)
        .filter((c) => !["created_at"].includes(c))
        .map((c) => `"${c}" = EXCLUDED."${c}"`),
    ].join(", ");

    const sql = `
      INSERT INTO cps.cps_profiles (id, user_id, context_type, ${colNames})
      VALUES ($1, $2, $3, ${valPlaceholders})
      ON CONFLICT (user_id, context_type)
      DO UPDATE SET ${setClause};
    `;

    await sequelize1.query(sql, {
      bind: [id, userId, context_type, ...bindValues],
      transaction: trx,
    });

    await trx.commit();
    console.log(`✅ CPS profile updated for user ${userId}`);
    return true;
  } catch (err) {
    await trx.rollback();
    console.error("❌ CPS aggregation failed:", err);
    return false;
  }
}
