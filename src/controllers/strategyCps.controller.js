import { CpsProfile } from "../Models/CpsProfile.model.js"; // assuming you have this model
import { User } from "../Models/UserModels/UserModel.js";
import { Op } from "sequelize";

// dimension groups
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

// helpers
const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;

// --- CONTROLLERS ---
export const getAggregate = async (req, res) => {
  try {
    const days = Math.max(parseInt(req.query.days || "90", 10), 1);
    const groupBy = String(req.query.groupBy || "none").toLowerCase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // ✅ Proper include with alias "user"
    const profiles = await CpsProfile.findAll({
      where: { updated_at: { [Op.gte]: cutoffDate } },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "location"],
        },
      ],
      // ❌ removed raw: true (keeps nested objects intact)
    });

    // calculate per-dimension averages per user
    const userScores = profiles.map((p) => {
      const dims = {};
      for (const dimKey of Object.keys(DIMS)) {
        const fields = DIMS[dimKey];
        const avg =
          fields.reduce((sum, f) => sum + (Number(p[f]) || 0), 0) /
          fields.length;
        dims[dimKey] = r2(avg);
      }
      return {
        userId: p.user_id,
        location: p.user?.location || "Unknown", // ✅ fixed alias
        updated_at: p.updated_at,
        ...dims,
      };
    });

    // overall medians
    const overall = {};
    for (const dimKey of Object.keys(DIMS)) {
      overall[dimKey] = r2(median(userScores.map((u) => u[dimKey])));
    }

    const response = {
      window_days: days,
      overall: {
        users: userScores.length,
        dimensions: overall,
        days_since_latest: userScores.length
          ? r2(
              (Date.now() -
                Math.max(...userScores.map((u) => +new Date(u.updated_at)))) /
                86400000
            )
          : null,
      },
      groupBy,
      groups: [],
    };

    // grouping
    if (groupBy === "location") {
      const groups = {};
      for (const u of userScores) {
        if (!groups[u.location]) groups[u.location] = [];
        groups[u.location].push(u);
      }
      response.groups = Object.entries(groups).map(([loc, users]) => {
        const dims = {};
        for (const dimKey of Object.keys(DIMS)) {
          dims[dimKey] = r2(median(users.map((u) => u[dimKey])));
        }
        return {
          group: loc,
          users: users.length,
          dimensions: dims,
          days_since_latest: r2(
            (Date.now() -
              Math.max(...users.map((u) => +new Date(u.updated_at)))) /
              86400000
          ),
        };
      });
    }

    res.json(response);
  } catch (err) {
    console.error("[Strategy CPS] aggregate failed:", err);
    res.status(500).json({ error: true, message: "Aggregate fetch failed." });
  }
};


export const getGeo = async (req, res) => {
  try {
    const days = Math.max(parseInt(req.query.days || "30", 10), 1);
    const min = Math.max(parseInt(req.query.min || "20", 10), 1);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const profiles = await CpsProfile.findAll({
      where: { updated_at: { [Op.gte]: cutoffDate } },
      include: [
        {
          model: User,
          attributes: ["id", "location"],
        },
      ],
      raw: true,
    });

    const bySegment = {};
    for (const p of profiles) {
      const segment = p["User.location"]?.trim() || "Unknown";
      if (!bySegment[segment]) bySegment[segment] = [];
      const dims = {};
      for (const dimKey of Object.keys(DIMS)) {
        const fields = DIMS[dimKey];
        dims[dimKey] =
          fields.reduce((sum, f) => sum + (Number(p[f]) || 0), 0) /
          fields.length;
      }
      bySegment[segment].push(dims);
    }

    const items = Object.entries(bySegment)
      .map(([segment, records]) => {
        if (records.length < min) return null;
        const medians = {};
        for (const dimKey of Object.keys(DIMS)) {
          medians[dimKey] = r2(median(records.map((r) => r[dimKey])));
        }
        return { segment, count: records.length, medians };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);

    res.json({ days, min, items });
  } catch (err) {
    console.error("[Strategy CPS] geo failed:", err);
    res.status(500).json({ error: true, message: "Failed to build geo aggregates." });
  }
};
