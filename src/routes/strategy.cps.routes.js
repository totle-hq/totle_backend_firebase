// routes/strategy.cps.routes.js
import express from "express";
import { sequelize1 } from "../config/sequelize.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

/** CPS dimension column lists (47 -> 6 dims) **/
const DIMS = {
  reasoning_strategy: [
    "pattern_recognition",
    "abstraction_capacity",
    "rule_inference",
    "decision_tree_depth",
    "problem_decomposition",
    "strategy_shift",
    "deductive_strength",
    "inductive_strength",
    "cognitive_rigidity",
    "tactical_depth",
  ],
  memory_retrieval: [
    "retention_curve",
    "recall_fidelity",
    "recognition_bias",
    "interference_resistance",
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

// Build AVG-of-fields SQL expression (per-user dimension score)
// Use COALESCE(field, 0) so missing values behave like your Ops/Research JS averaging.
function dimExprSQL(fields) {
  const n = fields.length;
  const sum = fields.map((f) => `COALESCE("p"."${f}", 0)`).join(" + ");
  return `((${sum}) / ${n}::numeric)`;
}

// Pre-build per-dimension expressions
const EXPR = {
  reasoning_strategy: dimExprSQL(DIMS.reasoning_strategy),
  memory_retrieval: dimExprSQL(DIMS.memory_retrieval),
  processing_fluency: dimExprSQL(DIMS.processing_fluency),
  attention_focus: dimExprSQL(DIMS.attention_focus),
  metacognition_regulation: dimExprSQL(DIMS.metacognition_regulation),
  resilience_adaptability: dimExprSQL(DIMS.resilience_adaptability),
};

// Helper: round to 2 decimals but keep as Number
const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;

/**
 * GET /strategy/cps/aggregate
 * Query:
 *   days=90            // time window (by updated_at), default 90
 *   groupBy=location   // optional; only 'location' supported now
 *
 * Returns overall medians + grouped medians (if groupBy provided).
 * NO PII, just counts and aggregates.
 */
router.get("/aggregate", async (req, res) => {
  try {
    const days = Math.max(parseInt(req.query.days || "90", 10), 1);
    const groupBy = String(req.query.groupBy || "none").toLowerCase();
    const groupExpr = groupBy === "location" ? `"u"."location"` : `NULL`;

    // Base CTE with per-user dimension scores
    const baseSQL = `
      WITH base AS (
        SELECT
          "u"."id" AS user_id,
          COALESCE(${groupExpr}, 'Unknown') AS grp,
          ${EXPR.reasoning_strategy}       AS reasoning_strategy,
          ${EXPR.memory_retrieval}         AS memory_retrieval,
          ${EXPR.processing_fluency}       AS processing_fluency,
          ${EXPR.attention_focus}          AS attention_focus,
          ${EXPR.metacognition_regulation} AS metacognition_regulation,
          ${EXPR.resilience_adaptability}  AS resilience_adaptability,
          "p"."updated_at"
        FROM "user"."users" AS "u"
        JOIN "user"."cps_profiles" AS "p" ON "p"."user_id" = "u"."id"
        WHERE "p"."updated_at" >= NOW() - INTERVAL '${days} days'
      )
    `;

    // Overall medians (no grouping)
    const overallSQL = `
      ${baseSQL}
      SELECT
        COUNT(*)::int AS users,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY reasoning_strategy)       AS med_reasoning_strategy,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY memory_retrieval)         AS med_memory_retrieval,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY processing_fluency)       AS med_processing_fluency,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attention_focus)          AS med_attention_focus,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY metacognition_regulation) AS med_metacognition_regulation,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY resilience_adaptability)  AS med_resilience_adaptability,
        (EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 86400.0)             AS days_since_latest
      FROM base;
    `;

    // Grouped medians (if requested)
    const groupedSQL =
      groupBy === "location"
        ? `
      ${baseSQL}
      SELECT
        grp AS "group",
        COUNT(*)::int AS users,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY reasoning_strategy)       AS med_reasoning_strategy,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY memory_retrieval)         AS med_memory_retrieval,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY processing_fluency)       AS med_processing_fluency,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attention_focus)          AS med_attention_focus,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY metacognition_regulation) AS med_metacognition_regulation,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY resilience_adaptability)  AS med_resilience_adaptability,
        (EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 86400.0)             AS days_since_latest
      FROM base
      GROUP BY grp
      ORDER BY users DESC, grp NULLS LAST;
    `
        : null;

    const overallRows = await sequelize1.query(overallSQL, { type: QueryTypes.SELECT });
    const overall = overallRows[0] || {};

    let groups = [];
    if (groupedSQL) {
      const rows = await sequelize1.query(groupedSQL, { type: QueryTypes.SELECT });
      groups = rows.map((r) => ({
        group: r.group || "Unknown",
        users: Number(r.users || 0),
        dimensions: {
          reasoning_strategy: r2(r.med_reasoning_strategy),
          memory_retrieval: r2(r.med_memory_retrieval),
          processing_fluency: r2(r.med_processing_fluency),
          attention_focus: r2(r.med_attention_focus),
          metacognition_regulation: r2(r.med_metacognition_regulation),
          resilience_adaptability: r2(r.med_resilience_adaptability),
        },
        days_since_latest: r2(r.days_since_latest),
      }));
    }

    res.json({
      window_days: days,
      overall: {
        users: Number(overall.users || 0),
        dimensions: {
          reasoning_strategy: r2(overall.med_reasoning_strategy),
          memory_retrieval: r2(overall.med_memory_retrieval),
          processing_fluency: r2(overall.med_processing_fluency),
          attention_focus: r2(overall.med_attention_focus),
          metacognition_regulation: r2(overall.med_metacognition_regulation),
          resilience_adaptability: r2(overall.med_resilience_adaptability),
        },
        days_since_latest: r2(overall.days_since_latest),
      },
      groupBy: groupBy === "location" ? "location" : "none",
      groups,
    });
  } catch (err) {
    console.error("[Strategy CPS] aggregate failed:", err);
    res.status(500).json({ error: true, message: "Aggregate fetch failed." });
  }
});

/**
 * GET /strategy/cps/geo
 * Query:
 *   days=30  (default 30)   - recency window by cps_profile.updated_at
 *   min=20  (default 20)    - minimum users per segment to include
 *
 * Returns choropleth-friendly medians per location (segment = user.location).
 * Example response:
 * {
 *   days: 30,
 *   min: 20,
 *   items: [
 *     {
 *       segment: "Bengaluru, IN",
 *       count: 42,
 *       medians: { reasoning_strategy: 61.2, ... }
 *     }
 *   ]
 * }
 */
router.get("/geo", async (req, res) => {
  try {
    const days = Math.max(parseInt(req.query.days || "30", 10), 1);
    const min = Math.max(parseInt(req.query.min || "20", 10), 1);

    const baseSQL = `
      WITH base AS (
        SELECT
          "u"."id" AS user_id,
          COALESCE(NULLIF(BTRIM("u"."location"), ''), 'Unknown') AS segment,
          ${EXPR.reasoning_strategy}       AS reasoning_strategy,
          ${EXPR.memory_retrieval}         AS memory_retrieval,
          ${EXPR.processing_fluency}       AS processing_fluency,
          ${EXPR.attention_focus}          AS attention_focus,
          ${EXPR.metacognition_regulation} AS metacognition_regulation,
          ${EXPR.resilience_adaptability}  AS resilience_adaptability,
          "p"."updated_at"
        FROM "user"."users" AS "u"
        JOIN "user"."cps_profiles" AS "p" ON "p"."user_id" = "u"."id"
        WHERE "p"."updated_at" >= NOW() - INTERVAL '${days} days'
      )
      SELECT
        segment,
        COUNT(*)::int AS count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY reasoning_strategy)       AS med_reasoning_strategy,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY memory_retrieval)         AS med_memory_retrieval,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY processing_fluency)       AS med_processing_fluency,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY attention_focus)          AS med_attention_focus,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY metacognition_regulation) AS med_metacognition_regulation,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY resilience_adaptability)  AS med_resilience_adaptability
      FROM base
      GROUP BY segment
      HAVING COUNT(*) >= ${min}
      ORDER BY count DESC, segment NULLS LAST;
    `;

    const rows = await sequelize1.query(baseSQL, { type: QueryTypes.SELECT });
    const items =
      (rows || []).map((r) => ({
        segment: r.segment || "Unknown",
        count: Number(r.count || 0),
        medians: {
          reasoning_strategy: r2(r.med_reasoning_strategy),
          memory_retrieval: r2(r.med_memory_retrieval),
          processing_fluency: r2(r.med_processing_fluency),
          attention_focus: r2(r.med_attention_focus),
          metacognition_regulation: r2(r.med_metacognition_regulation),
          resilience_adaptability: r2(r.med_resilience_adaptability),
        },
      })) || [];

    res.json({ days, min, items });
  } catch (err) {
    console.error("[Strategy CPS] geo failed:", err);
    res.status(500).json({ error: true, message: "Failed to build geo aggregates." });
  }
});

export default router;
