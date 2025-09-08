// Models/CpsProfile.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

/**
 * One row per user in schema "user".
 * Columns map to the already-created table "user"."cps_profiles".
 * Timestamps map to created_at/updated_at.
 */
const CpsProfile = sequelize1.define(
  "CpsProfile",
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },

    // --- Dimension 1 — Reasoning & Strategy ---
    pattern_recognition:         { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    abstraction_capacity:        { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    rule_inference:              { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    decision_tree_depth:         { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    problem_decomposition:       { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    strategy_shift:              { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    deductive_strength:          { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    inductive_strength:          { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    cognitive_rigidity:          { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tactical_depth:              { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },

    // --- Dimension 2 — Memory & Retrieval ---
    retention_curve:             { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    recall_fidelity:             { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    recognition_bias:            { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    interference_resistance:     { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    spaced_recall_effectiveness: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    memory_decay_rate:           { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    episodic_memory_flag:        { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },

    // --- Dimension 3 — Processing Speed & Fluency ---
    mean_response_time:          { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    speed_accuracy_tradeoff:     { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    adaptive_fluency_index:      { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    cognitive_load_tolerance:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    reaction_variability:        { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    decision_latency:            { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    fluency_recovery_rate:       { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },

    // --- Dimension 4 — Attention & Cognitive Focus ---
    active_engagement_ratio:     { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tab_switch_frequency:        { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    question_skipping_rate:      { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    hover_depth_index:           { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    backtracking_frequency:      { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    attention_recovery_rate:     { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    focus_decay_over_time:       { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },

    // --- Dimension 5 — Metacognition & Self-Regulation ---
    strategy_selection_score:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    self_correction_rate:        { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    hint_utilization_efficiency: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    planning_latency:            { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    reflective_comment_depth:    { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    retry_strategy_shift:        { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    time_reallocation_efficiency:{ type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    goal_alignment_flag:         { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },

    // --- Dimension 6 — Resilience & Adaptability ---
    persistence_score:           { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    resilience_rebound:          { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    frustration_threshold:       { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    effort_variability:          { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    strategy_adaptability:       { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    grit_trajectory:             { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    recovery_latency:            { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
    plateau_breaking_score:      { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  },
  {
    schema: "user",
    tableName: "cps_profiles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export { CpsProfile };
