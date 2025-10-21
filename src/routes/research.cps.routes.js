// routes/research.cps.routes.js
import express from "express";
import { Op } from "sequelize";
import { User } from "../Models/UserModels/UserModel.js";
import { CpsProfile } from "../Models/CpsProfile.model.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { Test } from "../Models/test.model.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";

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
/* -------------------------------------------------------------------------- */
/*  Enhanced Multi-Context CPS Research Endpoints (IQ | DOMAIN | TOPIC | ALL) */
/* -------------------------------------------------------------------------- */

/**
 * GET /research/cps/users
 * Supports ?context=IQ|DOMAIN|TOPIC|ALL
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
      context = "ALL", // <-- NEW
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

    // Date filter
    const cpsWhere = {};
    if (days && Number(days) > 0) {
      const ms = Number(days) * 24 * 60 * 60 * 1000;
      cpsWhere.updated_at = { [Op.gte]: new Date(Date.now() - ms) };
    }
    // Context filter
    if (["IQ","DOMAIN","TOPIC"].includes(context.toUpperCase())) {
      cpsWhere.context_type = context.toUpperCase();
    }

    // Fetch all CPS rows per user (not just one)
    const users = await User.findAll({
      where: userWhere,
      include: [
        {
          model: CpsProfile,
          as: "cpsProfile",
          required: true,
          where: cpsWhere,
          attributes: ["user_id","context_type","context_ref_id","updated_at", ...CPS_FIELDS],
        },
      ],
      attributes: ["id","firstName","lastName","email","status","location","createdAt","updatedAt"],
      order: [["updatedAt", dirNorm]],
      limit: lim,
      offset: off,
      distinct: true,
    });

    const items = users.map(u => {
      const profiles = Array.isArray(u.cpsProfile) ? u.cpsProfile : [u.cpsProfile];
      const groupedByContext = {};

      for (const p of profiles) {
        const ctx = p.context_type || "IQ";
        if (!groupedByContext[ctx]) groupedByContext[ctx] = [];
        groupedByContext[ctx].push(p);
      }

      // Compute averages per context
      const ctxAverages = {};
      for (const [ctx, list] of Object.entries(groupedByContext)) {
        const merged = {};
        for (const f of CPS_FIELDS) {
          const vals = list.map(l => Number(l[f] ?? 0));
          merged[f] = vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
        }
        ctxAverages[ctx] = {
          updated_at: list[0]?.updated_at,
          dims: {
            reasoning_strategy:       avg(merged, DIMENSIONS.reasoning_strategy),
            memory_retrieval:         avg(merged, DIMENSIONS.memory_retrieval),
            processing_fluency:       avg(merged, DIMENSIONS.processing_fluency),
            attention_focus:          avg(merged, DIMENSIONS.attention_focus),
            metacognition_regulation: avg(merged, DIMENSIONS.metacognition_regulation),
            resilience_adaptability:  avg(merged, DIMENSIONS.resilience_adaptability),
          },
          params: full === "1" ? Object.fromEntries(CPS_FIELDS.map(k => [k, Number(merged[k] ?? 0)])) : {},
        };
      }

      // Aggregate view for context=ALL
      const combined = (() => {
if (Object.keys(ctxAverages).length === 1) return Object.values(ctxAverages)[0];

// If each context omitted params (full=0), use their dims instead
const hasParams = Object.values(ctxAverages).some(c => Object.keys(c.params || {}).length > 0);
const allVals = {};

if (hasParams) {
  for (const k of CPS_FIELDS) {
    const ctxVals = Object.values(ctxAverages).map(c => c.params?.[k] ?? 0);
    allVals[k] = ctxVals.length ? ctxVals.reduce((a,b)=>a+b,0) / ctxVals.length : 0;
  }
} else {
  // fallback: use dimension averages
  for (const [dim, keys] of Object.entries(DIMENSIONS)) {
    const dimVals = Object.values(ctxAverages).map(c => c.dims?.[dim] ?? 0);
    allVals[dim] = dimVals.length ? dimVals.reduce((a,b)=>a+b,0) / dimVals.length : 0;
  }
}

        return {
          dims: {
            reasoning_strategy:       avg(allVals, DIMENSIONS.reasoning_strategy),
            memory_retrieval:         avg(allVals, DIMENSIONS.memory_retrieval),
            processing_fluency:       avg(allVals, DIMENSIONS.processing_fluency),
            attention_focus:          avg(allVals, DIMENSIONS.attention_focus),
            metacognition_regulation: avg(allVals, DIMENSIONS.metacognition_regulation),
            resilience_adaptability:  avg(allVals, DIMENSIONS.resilience_adaptability),
          },
          params: allVals,
        };
      })();

      return {
        id: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.email,
        status: u.status,
        location: u.location,
        contexts: ctxAverages, // NEW
        combined,              // NEW
      };
    });

    res.json({ total: items.length, limit: lim, offset: off, items });
  } catch (err) {
    console.error("[Research CPS] multi-context list failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch CPS list." });
  }
});

/**
 * GET /research/cps/users/:userId
 * Returns full grouped CPS for IQ, DOMAIN, TOPIC separately.
 */
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const profiles = await CpsProfile.findAll({
      where: { user_id: userId },
      attributes: ["user_id","context_type","context_ref_id","created_at","updated_at", ...CPS_FIELDS],
    });

    if (!profiles.length) {
      return res.status(404).json({ error: true, message: "No CPS profiles found for user." });
    }

    const grouped = {};
    for (const p of profiles) {
      const ctx = p.context_type || "IQ";
      const base = {
        created_at: p.created_at,
        updated_at: p.updated_at,
        dimensions: {},
        all_params: Object.fromEntries(CPS_FIELDS.map(k => [k, Number(p[k] ?? 0)])),
      };
      for (const [dim, keys] of Object.entries(DIMENSIONS)) {
        base.dimensions[dim] = {
          average: avg(p, keys),
          fields: Object.fromEntries(keys.map(k => [k, Number(p[k] ?? 0)])),
        };
      }
      if (!grouped[ctx]) grouped[ctx] = [];
      grouped[ctx].push(base);
    }

    // Aggregate per context type (average across all domains/topics)
    const aggregated = {};
    for (const [ctx, arr] of Object.entries(grouped)) {
      const merged = {};
      for (const f of CPS_FIELDS) {
        const vals = arr.map(x => x.all_params[f]);
        merged[f] = vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
      }
      aggregated[ctx] = {
        average_dims: {
          reasoning_strategy:       avg(merged, DIMENSIONS.reasoning_strategy),
          memory_retrieval:         avg(merged, DIMENSIONS.memory_retrieval),
          processing_fluency:       avg(merged, DIMENSIONS.processing_fluency),
          attention_focus:          avg(merged, DIMENSIONS.attention_focus),
          metacognition_regulation: avg(merged, DIMENSIONS.metacognition_regulation),
          resilience_adaptability:  avg(merged, DIMENSIONS.resilience_adaptability),
        },
        all_params: merged,
      };
    }

    res.json({
      userId,
      contexts: aggregated,
    });
  } catch (err) {
    console.error("[Research CPS] multi-context detail failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch CPS detail." });
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

// src/routes/research.cps.routes.js
router.get("/search-by-uuid/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;

    // 1. Find node
    const node = await CatalogueNode.findOne({ where: { node_id: uuid } });
    if (!node) {
      return res.status(404).json({ error: true, message: "Node not found" });
    }

    // 2. Collect users if node is a topic
    let items = [];
    if (node.is_topic) {
      const tests = await Test.findAll({
        where: { topic_uuid: uuid },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id","firstName","lastName","email","status","location","createdAt","updatedAt"],
            include: [
              {
                model: CpsProfile,
                as: "cpsProfile",
                required: false,
                attributes: ["user_id","created_at","updated_at", ...CPS_FIELDS],
              },
            ],
          },
        ],
        attributes: ["test_id","createdAt","updatedAt"],
      });

      items = tests
        .filter(t => t.user) // only valid tests with user
        .map(t => {
          const u = t.user;
          const p = u.cpsProfile || {};

          return {
            user: {
              id: u.id,
              name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
              email: u.email,
              status: u.status,
              location: u.location,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
            },
            cps: p.user_id
              ? {
                  created_at: p.created_at,
                  updated_at: p.updated_at,
                  dimensions: {
                    reasoning_strategy: {
                      average: avg(p, DIMENSIONS.reasoning_strategy),
                      fields: Object.fromEntries(DIMENSIONS.reasoning_strategy.map(f => [f, Number(p[f] ?? 0)])),
                    },
                    memory_retrieval: {
                      average: avg(p, DIMENSIONS.memory_retrieval),
                      fields: Object.fromEntries(DIMENSIONS.memory_retrieval.map(f => [f, Number(p[f] ?? 0)])),
                    },
                    processing_fluency: {
                      average: avg(p, DIMENSIONS.processing_fluency),
                      fields: Object.fromEntries(DIMENSIONS.processing_fluency.map(f => [f, Number(p[f] ?? 0)])),
                    },
                    attention_focus: {
                      average: avg(p, DIMENSIONS.attention_focus),
                      fields: Object.fromEntries(DIMENSIONS.attention_focus.map(f => [f, Number(p[f] ?? 0)])),
                    },
                    metacognition_regulation: {
                      average: avg(p, DIMENSIONS.metacognition_regulation),
                      fields: Object.fromEntries(DIMENSIONS.metacognition_regulation.map(f => [f, Number(p[f] ?? 0)])),
                    },
                    resilience_adaptability: {
                      average: avg(p, DIMENSIONS.resilience_adaptability),
                      fields: Object.fromEntries(DIMENSIONS.resilience_adaptability.map(f => [f, Number(p[f] ?? 0)])),
                    },
                  },
                  all_params: Object.fromEntries(CPS_FIELDS.map(k => [k, Number(p[k] ?? 0)])),
                }
              : null,
          };
        });
    }

    res.json({
      node: {
        id: node.node_id,
        name: node.name,
        level: node.node_level,
        is_topic: node.is_topic,
        is_subject: node.is_subject,
        is_domain: node.is_domain,
      },
      total: items.length,
      items,
    });
  } catch (err) {
    console.error("[Research CPS] search-by-uuid failed:", err);
    res.status(500).json({ error: true, message: "Failed to fetch by UUID" });
  }
});

async function getAllDescendantNodeIds(nodeId) {
  const children = await CatalogueNode.findAll({
    where: { parent_id: nodeId },
    attributes: ["node_id"],
  });

  let ids = children.map(c => c.node_id);

  for (const child of children) {
    const subIds = await getAllDescendantNodeIds(child.node_id);
    ids = ids.concat(subIds);
  }
  return ids;
}

/**
 * Extract cps_scores from result/performance_metrics
 */
function extractCpsScores(test) {
  const a = test?.result?.cps_scores;
  if (a && typeof a === "object") return a;
  const b = test?.performance_metrics?.cps_scores;
  if (b && typeof b === "object") return b;
  return null;
}

// Dimensions present in CpsProfile
const DIMENSION_KEYS = [
  "reasoning_strategy",
  "memory_retrieval",
  "processing_fluency",
  "attention_focus",
  "metacognition_regulation",
  "resilience_adaptability",
];

// All CPS fields from CpsProfile (excluding metadata)
const ALL_CPS_FIELDS = Object.keys(CpsProfile.rawAttributes).filter(
  k =>
    ![
      "user_id",
      "tests_seen",
      "last_test_id",
      "created_at",
      "updated_at",
    ].includes(k)
);

export const getUserNodeCps = async (req, res) => {
  const { userId, nodeId } = req.params;

  try {
    // 1. Collect node + descendants
    const nodeIds = [nodeId, ...(await getAllDescendantNodeIds(nodeId))];

    // 2. Find tests for this user under those topics
    const tests = await Test.findAll({
      where: {
        user_id: userId,
        topic_uuid: { [Op.in]: nodeIds },
        submitted_at: { [Op.ne]: null },
      },
      raw: true,
    });

    if (!tests.length) {
      // return all zeros if no tests found
      const zeroDims = Object.fromEntries(DIMENSION_KEYS.map(k => [k, 0]));
      const zeroFields = Object.fromEntries(
        ALL_CPS_FIELDS.filter(k => !DIMENSION_KEYS.includes(k)).map(k => [k, 0])
      );
      return res.json({ dimensions: zeroDims, fields: zeroFields });
    }

    // 3. Aggregate scores
    const fieldSums = {};
    const fieldCounts = {};

    tests.forEach(test => {
      const scores = extractCpsScores(test);
      if (!scores) return;

      Object.entries(scores).forEach(([k, v]) => {
        if (typeof v === "number") {
          fieldSums[k] = (fieldSums[k] || 0) + v;
          fieldCounts[k] = (fieldCounts[k] || 0) + 1;
        }
      });
    });

    // 4. Compute averages
    const avgFields = {};
    for (const [k, sum] of Object.entries(fieldSums)) {
      avgFields[k] = sum / fieldCounts[k];
    }

    // 5. Build dimensions from avgFields (if fields are mapped to them)
    // For now, just return them as 0 unless you define a mapping
    const finalDims = {};
    DIMENSION_KEYS.forEach(k => {
      finalDims[k] = avgFields[k] ?? 0; // if cps_scores directly contain dimension keys
    });

    // 6. Ensure all fields exist with fallback = 0
    const finalFields = {};
    ALL_CPS_FIELDS.filter(k => !DIMENSION_KEYS.includes(k)).forEach(k => {
      finalFields[k] = avgFields[k] ?? 0;
    });

    return res.json({
      dimensions: finalDims,
      fields: finalFields,
    });
  } catch (err) {
    console.error("Error in getUserNodeCps:", err);
    res.status(500).json({ error: "Failed to fetch node CPS summary" });
  }
};
router.get("/users/:userId/nodes/:nodeId", getUserNodeCps);


export default router;
