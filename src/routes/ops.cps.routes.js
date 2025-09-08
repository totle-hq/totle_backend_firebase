// routes/ops.cps.routes.js
import express from "express";
import { Op } from "sequelize";
import { User } from "../Models/UserModels/UserModel.js";
import { CpsProfile } from "../Models/CpsProfile.model.js";

const router = express.Router();

// --- 6 dimension groupings (we'll only return averages) ---
const DIMS = {
  reasoning_strategy: [
    "pattern_recognition","abstraction_capacity","rule_inference","decision_tree_depth",
    "problem_decomposition","strategy_shift","deductive_strength","inductive_strength",
    "cognitive_rigidity","tactical_depth",
  ],
  memory_retrieval: [
    "retention_curve","recall_fidelity","recognition_bias","interference_resistance",
    "spaced_recall_effectiveness","memory_decay_rate","episodic_memory_flag",
  ],
  processing_fluency: [
    "mean_response_time","speed_accuracy_tradeoff","adaptive_fluency_index",
    "cognitive_load_tolerance","reaction_variability","decision_latency","fluency_recovery_rate",
  ],
  attention_focus: [
    "active_engagement_ratio","tab_switch_frequency","question_skipping_rate","hover_depth_index",
    "backtracking_frequency","attention_recovery_rate","focus_decay_over_time",
  ],
  metacognition_regulation: [
    "strategy_selection_score","self_correction_rate","hint_utilization_efficiency","planning_latency",
    "reflective_comment_depth","retry_strategy_shift","time_reallocation_efficiency","goal_alignment_flag",
  ],
  resilience_adaptability: [
    "persistence_score","resilience_rebound","frustration_threshold","effort_variability",
    "strategy_adaptability","grit_trajectory","recovery_latency","plateau_breaking_score",
  ],
};

function avg(obj, keys) {
  const vals = keys.map((k) => Number(obj?.[k] ?? 0));
  return vals.length
    ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    : 0;
}

// simple UUID v4 guard
const isUuid = (s) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    String(s || "")
  );

/**
 * GET /ops/cps/users
 * List: learner basic info + 6 dimension averages (no 47 raw fields)
 * Query:
 *   q=         (name/email search)
 *   days=30    (optional: only include cps updated in last N days)
 *   limit=10, offset=0
 *   dir=asc|desc  (default desc) — sorts by cpsProfile.updated_at
 */
router.get("/users", async (req, res) => {
  try {
    const { q = "", days, limit = "10", offset = "0", dir = "desc" } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const orderDir = String(dir).toLowerCase() === "asc" ? "ASC" : "DESC";

    const userWhere = {};
    if (q) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName:  { [Op.iLike]: `%${q}%` } },
        { email:     { [Op.iLike]: `%${q}%` } },
      ];
    }

    const cpsWhere = {};
    if (days && Number(days) > 0) {
      const ms = Number(days) * 24 * 60 * 60 * 1000;
      cpsWhere.updated_at = { [Op.gte]: new Date(Date.now() - ms) };
    }

    const { rows, count } = await User.findAndCountAll({
      where: userWhere,
      include: [
        {
          model: CpsProfile,
          as: "cpsProfile",
          required: true,
          where: cpsWhere,
          // fetch only the columns needed to compute averages
          attributes: ["updated_at", ...Object.values(DIMS).flat()],
        },
      ],
      order: [[{ model: CpsProfile, as: "cpsProfile" }, "updated_at", orderDir]],
      limit: lim,
      offset: off,
      distinct: true,
      attributes: ["id", "firstName", "lastName", "email", "location"],
    });

    const items = rows.map((u) => {
      const p = u.cpsProfile || {};
      return {
        id: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.email,
        location: u.location,
        updated_at: p.updated_at,
        dimensions: {
          reasoning_strategy:       avg(p, DIMS.reasoning_strategy),
          memory_retrieval:         avg(p, DIMS.memory_retrieval),
          processing_fluency:       avg(p, DIMS.processing_fluency),
          attention_focus:          avg(p, DIMS.attention_focus),
          metacognition_regulation: avg(p, DIMS.metacognition_regulation),
          resilience_adaptability:  avg(p, DIMS.resilience_adaptability),
        },
      };
    });

    res.json({ total: count, limit: lim, offset: off, items });
  } catch (err) {
    console.error("[Ops CPS] list failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch Ops CPS list." });
  }
});

/**
 * GET /ops/cps/users/:userId
 * Detail: 6 dimension averages for one learner (no 47 raw fields)
 */
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Guard prevents "/ops/cps/users" from ever matching this route by accident
    if (!isUuid(userId)) {
      return res.status(400).json({ error: true, message: "Invalid user id" });
    }

    const user = await User.findOne({
      where: { id: userId },
      include: [
        {
          model: CpsProfile,
          as: "cpsProfile",
          required: true,
          attributes: ["updated_at", ...Object.values(DIMS).flat()],
        },
      ],
      attributes: ["id", "firstName", "lastName", "email", "location"],
    });

    if (!user) return res.status(404).json({ error: true, message: "User not found" });

    const p = user.cpsProfile || {};
    res.json({
      user: {
        id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        location: user.location,
      },
      cps: {
        updated_at: p.updated_at,
        dimensions: {
          reasoning_strategy:       avg(p, DIMS.reasoning_strategy),
          memory_retrieval:         avg(p, DIMS.memory_retrieval),
          processing_fluency:       avg(p, DIMS.processing_fluency),
          attention_focus:          avg(p, DIMS.attention_focus),
          metacognition_regulation: avg(p, DIMS.metacognition_regulation),
          resilience_adaptability:  avg(p, DIMS.resilience_adaptability),
        },
      },
    });
  } catch (err) {
    console.error("[Ops CPS] detail failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch Ops CPS detail." });
  }
});

export default router;
