// src/routes/admin.cps.routes.js
import express from "express";
import { Op } from "sequelize";
import { User } from "../Models/UserModels/UserModel.js";
import { CpsProfile } from "../Models/CpsProfile.model.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";

const router = express.Router();

/* ----------------------------- CPS FIELD LIST ----------------------------- */
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
  return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0;
}

/* -------------------------------------------------------------------------- */
/*                                LIST ROUTE                                  */
/* -------------------------------------------------------------------------- */
/**
 * GET /admin/cps
 * ?context_type=IQ|DOMAIN|TOPIC
 * ?context_ref_id=<uuid>
 * ?q=<name|email>
 * ?sort=<field>
 * ?dir=asc|desc
 * ?limit=10
 * ?offset=0
 */
router.get("/", async (req, res) => {
  try {
    const {
      q = "",
      sort = "updated_at",
      dir = "desc",
      limit = "10",
      offset = "0",
      context_type = "IQ",
      context_ref_id = null,
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    // User filters
    const userWhere = {};
    if (q) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // CPS filters
    const cpsWhere = { context_type };
    if (context_ref_id) cpsWhere.context_ref_id = context_ref_id;

    for (const f of CPS_FIELDS) {
      const minKey = `min_${f}`;
      const maxKey = `max_${f}`;
      if (minKey in req.query || maxKey in req.query) {
        cpsWhere[f] = {};
        if (minKey in req.query) cpsWhere[f][Op.gte] = Number(req.query[minKey]);
        if (maxKey in req.query) cpsWhere[f][Op.lte] = Number(req.query[maxKey]);
      }
    }

    // Sorting
    const order = [];
    const dirNorm = String(dir).toLowerCase() === "asc" ? "ASC" : "DESC";
    if (["firstName","lastName","email","createdAt","updatedAt"].includes(sort)) {
      order.push([sort, dirNorm]);
    } else if (CPS_FIELDS.includes(sort)) {
      order.push([{ model: CpsProfile, as: "cpsProfiles" }, sort, dirNorm]);
    } else {
      order.push([{ model: CpsProfile, as: "cpsProfiles" }, "updated_at", "DESC"]);
    }

    // Query users + CPS
    const { rows, count } = await User.findAndCountAll({
      where: userWhere,
      include: [
        {
          model: CpsProfile,
          as: "cpsProfiles",
          required: true,
          where: cpsWhere,
          attributes: [
            "user_id",
            "context_type",
            "context_ref_id",
            "updated_at",
            ...CPS_FIELDS,
          ],
          include: [
            {
              model: CatalogueNode,
              as: "domain",
              attributes: ["node_id", "name", "node_type"],
            },
          ],
        },
      ],
      order,
      limit: lim,
      offset: off,
      distinct: true,
      attributes: ["id","firstName","lastName","email","status","location","createdAt","updatedAt"],
    });

    // Shape data
    const data = rows.map((u) => {
      const profiles = Array.isArray(u.cpsProfiles) ? u.cpsProfiles : [];
      return profiles.map((p) => ({
        id: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.email,
        status: u.status,
        location: u.location,
        context_type: p.context_type,
        context_ref: p.domain ? p.domain.name : null,
        updated_at: p.updated_at,
        dims: {
          reasoning_strategy:       avg(p, DIMENSIONS.reasoning_strategy),
          memory_retrieval:         avg(p, DIMENSIONS.memory_retrieval),
          processing_fluency:       avg(p, DIMENSIONS.processing_fluency),
          attention_focus:          avg(p, DIMENSIONS.attention_focus),
          metacognition_regulation: avg(p, DIMENSIONS.metacognition_regulation),
          resilience_adaptability:  avg(p, DIMENSIONS.resilience_adaptability),
        },
      }));
    }).flat();

    res.json({ total: count, limit: lim, offset: off, items: data });
  } catch (err) {
    console.error("[CPS] list failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch CPS users." });
  }
});

/* -------------------------------------------------------------------------- */
/*                                DETAIL ROUTE                                */
/* -------------------------------------------------------------------------- */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { context_type = "IQ", context_ref_id = null } = req.query;

    const user = await User.findOne({
      where: { id: userId },
      include: [
        {
          model: CpsProfile,
          as: "cpsProfiles",
          required: true,
          where: { context_type, context_ref_id },
          attributes: [
            "user_id",
            "context_type",
            "context_ref_id",
            "created_at",
            "updated_at",
            ...CPS_FIELDS,
          ],
          include: [
            {
              model: CatalogueNode,
              as: "domain",
              attributes: ["node_id", "name", "node_type"],
            },
          ],
        },
      ],
      attributes: ["id","firstName","lastName","email","status","location","createdAt","updatedAt"],
    });

    if (!user) return res.status(404).json({ error: true, message: "User not found" });

    const profiles = user.cpsProfiles || [];
    const cpsDetails = profiles.map((p) => {
      const grouped = {};
      for (const [dim, keys] of Object.entries(DIMENSIONS)) {
        grouped[dim] = {
          fields: Object.fromEntries(keys.map(k => [k, Number(p[k] ?? 0)])),
          average: avg(p, keys),
        };
      }
      return {
        context_type: p.context_type,
        context_ref: p.domain ? p.domain.name : null,
        updated_at: p.updated_at,
        dimensions: grouped,
      };
    });

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
      cps: cpsDetails,
    });
  } catch (err) {
    console.error("[CPS] detail failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch CPS profile." });
  }
});

/* -------------------------------------------------------------------------- */
/*                                PATCH ROUTE                                 */
/* -------------------------------------------------------------------------- */
router.patch("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { context_type = "IQ", context_ref_id = null } = req.query;

    const payload = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (CPS_FIELDS.includes(k)) payload[k] = Number(v);
    }
    if (!Object.keys(payload).length) {
      return res.status(400).json({ error: true, message: "No valid CPS fields in body." });
    }

    const [n] = await CpsProfile.update(payload, {
      where: { user_id: userId, context_type, context_ref_id },
    });

    if (!n) {
      return res.status(404).json({ error: true, message: "CPS row not found for specified context." });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[CPS] patch failed:", err);
    res.status(500).json({ error: true, message: "Failed to update CPS values." });
  }
});

export default router;
