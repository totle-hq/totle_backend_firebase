// routes/research.cps.routes.js
import express from "express";
import { Op } from "sequelize";
import { User } from "../Models/UserModels/UserModel.js";
import { CpsProfile } from "../Models/CpsProfile.model.js";

const router = express.Router();

/** 47 CPS fields (flat) */
const CPS_FIELDS = [
  // Dimension 1 — Reasoning & Strategy (10)
  "pattern_recognition","abstraction_capacity","rule_inference","decision_tree_depth","problem_decomposition",
  "strategy_shift","deductive_strength","inductive_strength","cognitive_rigidity","tactical_depth",
  // Dimension 2 — Memory & Retrieval (7)
  "retention_curve","recall_fidelity","recognition_bias","interference_resistance","spaced_recall_effectiveness","memory_decay_rate","episodic_memory_flag",
  // Dimension 3 — Processing Speed & Fluency (7)
  "mean_response_time","speed_accuracy_tradeoff","adaptive_fluency_index","cognitive_load_tolerance","reaction_variability","decision_latency","fluency_recovery_rate",
  // Dimension 4 — Attention & Cognitive Focus (7)
  "active_engagement_ratio","tab_switch_frequency","question_skipping_rate","hover_depth_index","backtracking_frequency","attention_recovery_rate","focus_decay_over_time",
  // Dimension 5 — Metacognition & Self-Regulation (8)
  "strategy_selection_score","self_correction_rate","hint_utilization_efficiency","planning_latency","reflective_comment_depth","retry_strategy_shift","time_reallocation_efficiency","goal_alignment_flag",
  // Dimension 6 — Resilience & Adaptability (8)
  "persistence_score","resilience_rebound","frustration_threshold","effort_variability","strategy_adaptability","grit_trajectory","recovery_latency","plateau_breaking_score",
];

/** Groupings for Research UI */
const DIMENSIONS = {
  reasoning_strategy: [
    "pattern_recognition","abstraction_capacity","rule_inference","decision_tree_depth","problem_decomposition",
    "strategy_shift","deductive_strength","inductive_strength","cognitive_rigidity","tactical_depth",
  ],
  memory_retrieval: [
    "retention_curve","recall_fidelity","recognition_bias","interference_resistance","spaced_recall_effectiveness","memory_decay_rate","episodic_memory_flag",
  ],
  processing_fluency: [
    "mean_response_time","speed_accuracy_tradeoff","adaptive_fluency_index","cognitive_load_tolerance","reaction_variability","decision_latency","fluency_recovery_rate",
  ],
  attention_focus: [
    "active_engagement_ratio","tab_switch_frequency","question_skipping_rate","hover_depth_index","backtracking_frequency","attention_recovery_rate","focus_decay_over_time",
  ],
  metacognition_regulation: [
    "strategy_selection_score","self_correction_rate","hint_utilization_efficiency","planning_latency","reflective_comment_depth","retry_strategy_shift","time_reallocation_efficiency","goal_alignment_flag",
  ],
  resilience_adaptability: [
    "persistence_score","resilience_rebound","frustration_threshold","effort_variability","strategy_adaptability","grit_trajectory","recovery_latency","plateau_breaking_score",
  ],
};

function avg(obj, keys) {
  const vals = keys.map(k => Number(obj?.[k] ?? 0));
  return vals.length ? Number((vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2)) : 0;
}

/**
 * GET /research/cps/users
 * Research list view with search/sort/filter/pagination.
 * Query:
 *   q=           (name/email search)
 *   days=90      (only rows updated in the last N days; omit to include all)
 *   sort=updated_at|firstName|lastName|email|<any CPS field>
 *   dir=asc|desc
 *   limit=10, offset=0
 *   full=1       (include all 47 fields in each item)
 *   min_<field>=X / max_<field>=Y (filter on any CPS field)
 */
router.get("/users", async (req, res) => {
  try {
    const {
      q = "",
      days,
      sort = "updated_at",
      dir = "desc",
      limit = "10",
      offset = "0",
      full = "1",
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 200);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const dirNorm = String(dir).toLowerCase() === "asc" ? "ASC" : "DESC";

    // Search (User)
    const userWhere = {};
    if (q) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName:  { [Op.iLike]: `%${q}%` } },
        { email:     { [Op.iLike]: `%${q}%` } },
      ];
    }

    // CPS filters
    const cpsWhere = {};
    for (const f of CPS_FIELDS) {
      const minKey = `min_${f}`;
      const maxKey = `max_${f}`;
      if (minKey in req.query || maxKey in req.query) {
        cpsWhere[f] = {};
        if (minKey in req.query) cpsWhere[f][Op.gte] = Number(req.query[minKey]);
        if (maxKey in req.query) cpsWhere[f][Op.lte] = Number(req.query[maxKey]);
      }
    }
    // days filter on updated_at
    if (days && Number(days) > 0) {
      const ms = Number(days) * 24 * 60 * 60 * 1000;
      cpsWhere.updated_at = { [Op.gte]: new Date(Date.now() - ms) };
    }

    // Sorting
    const order = [];
    if (["firstName","lastName","email","createdAt","updatedAt"].includes(sort)) {
      order.push([sort, dirNorm]);
    } else if (CPS_FIELDS.includes(sort)) {
      order.push([{ model: CpsProfile, as: "cpsProfile" }, sort, dirNorm]);
    } else if (sort === "updated_at") {
      order.push([{ model: CpsProfile, as: "cpsProfile" }, "updated_at", dirNorm]);
    } else {
      order.push([{ model: CpsProfile, as: "cpsProfile" }, "updated_at", "DESC"]);
    }

    const { rows, count } = await User.findAndCountAll({
      where: userWhere,
      include: [
        {
          model: CpsProfile,
          as: "cpsProfile",
          required: true,
          where: cpsWhere,
          attributes: ["user_id","updated_at", ...CPS_FIELDS],
        },
      ],
      order,
      limit: lim,
      offset: off,
      distinct: true,
      attributes: ["id","firstName","lastName","email","status","location","createdAt","updatedAt"],
    });

    const items = rows.map(u => {
      const p = u.cpsProfile || {};
      const base = {
        id: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.email,
        status: u.status,
        location: u.location,
        updated_at: p.updated_at,
        dims: {
          reasoning_strategy:       avg(p, DIMENSIONS.reasoning_strategy),
          memory_retrieval:         avg(p, DIMENSIONS.memory_retrieval),
          processing_fluency:       avg(p, DIMENSIONS.processing_fluency),
          attention_focus:          avg(p, DIMENSIONS.attention_focus),
          metacognition_regulation: avg(p, DIMENSIONS.metacognition_regulation),
          resilience_adaptability:  avg(p, DIMENSIONS.resilience_adaptability),
        },
      };
      if (full === "1") {
        base.params = Object.fromEntries(CPS_FIELDS.map(k => [k, Number(p[k] ?? 0)]));
      }
      return base;
    });

    res.json({ total: count, limit: lim, offset: off, items });
  } catch (err) {
    console.error("[Research CPS] list failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch CPS research list." });
  }
});

/**
 * GET /research/cps/users/:userId
 * Full 47-parameter snapshot (grouped) for a user.
 */
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({
      where: { id: userId },
      include: [
        {
          model: CpsProfile,
          as: "cpsProfile",
          required: true,
          attributes: ["user_id","created_at","updated_at", ...CPS_FIELDS],
        },
      ],
      attributes: ["id","firstName","lastName","email","status","location","createdAt","updatedAt"],
    });
    if (!user) return res.status(404).json({ error: true, message: "User not found" });

    const p = user.cpsProfile || {};
    const grouped = {};
    for (const [dim, keys] of Object.entries(DIMENSIONS)) {
      grouped[dim] = {
        fields: Object.fromEntries(keys.map(k => [k, Number(p[k] ?? 0)])),
        average: avg(p, keys),
      };
    }

    res.json({
      user: {
        id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        status: user.status,
        location: user.location,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      cps: {
        created_at: p.created_at,
        updated_at: p.updated_at,
        dimensions: grouped,
        all_params: Object.fromEntries(CPS_FIELDS.map(k => [k, Number(p[k] ?? 0)])),
      },
    });
  } catch (err) {
    console.error("[Research CPS] detail failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch CPS research detail." });
  }
});

/**
 * GET /research/cps/export.csv
 * CSV export of users with all 47 fields (PII = id,email,firstName,lastName,location).
 * Query:
 *   days=        (optional window on cps_profile.updated_at)
 */
router.get("/export.csv", async (req, res) => {
  try {
    const days = Number(req.query.days || 0);
    const cpsWhere = {};
    if (days > 0) {
      const ms = days * 24 * 60 * 60 * 1000;
      cpsWhere.updated_at = { [Op.gte]: new Date(Date.now() - ms) };
    }

    const rows = await User.findAll({
      include: [
        {
          model: CpsProfile,
          as: "cpsProfile",
          required: true,
          where: cpsWhere,
          attributes: ["updated_at", ...CPS_FIELDS],
        },
      ],
      attributes: ["id","email","firstName","lastName","location"],
      order: [[{ model: CpsProfile, as: "cpsProfile" }, "updated_at", "DESC"]],
    });

    const headers = [
      "user_id","email","firstName","lastName","location","updated_at",
      ...CPS_FIELDS,
    ];
    const escape = v => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [];
    lines.push(headers.join(","));
    for (const u of rows) {
      const p = u.cpsProfile || {};
      const row = [
        u.id, u.email || "", u.firstName || "", u.lastName || "", u.location || "",
        p.updated_at ? new Date(p.updated_at).toISOString() : "",
        ...CPS_FIELDS.map(k => Number(p[k] ?? 0)),
      ];
      lines.push(row.map(escape).join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cps_research_export.csv"');
    res.send(lines.join("\n"));
  } catch (err) {
    console.error("[Research CPS] export failed:", err);
    res.status(500).json({ error: true, message: "Export failed." });
  }
});

export default router;
