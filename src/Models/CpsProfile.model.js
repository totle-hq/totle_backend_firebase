// src/Models/CpsProfile.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

/**
 * Multi-context CPS profile
 *  • context_type = 'IQ' | 'DOMAIN' | 'TOPIC'
 *  • context_ref_id = domain_id or topic_id (nullable)
 * One user can now have multiple CPS rows: one for IQ, one per Domain, etc.
 */
const CpsProfile = sequelize1.define(
  "CpsProfile",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      comment: "Primary key for each contextual CPS row",
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { tableName: "users", schema: "user" },
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      comment: "Links CPS record to the user",
    },

    /* ---------- Context fields ---------- */
    context_type: {
      type: DataTypes.ENUM("IQ", "DOMAIN", "TOPIC"),
      allowNull: false,
        defaultValue: "IQ", // ✅ ensures no null violations for new rows

      comment: "Type of CPS profile: IQ baseline, Domain aggregate, or Topic level",
    },
    context_ref_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Domain_id or topic_id from catalogue_nodes (nullable for IQ)",
    },

    /* ---------- Bookkeeping ---------- */
    tests_seen: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "How many tests contributed to this profile",
    },
    last_test_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Most recent Test.test_id that updated this profile",
    },
    average_dims: {
  type: DataTypes.JSONB,
  allowNull: true,
  comment: "Aggregated per-parameter CPS averages (47-parameter JSON)",
},
overall_score: {
  type: DataTypes.FLOAT,
  allowNull: true,
  defaultValue: 0,
  comment: "Overall CPS normalized score derived from parameter averages",
},


    /* ---------- 47 CPS parameters ---------- */
    // --- Dimension 1 — Reasoning & Strategy ---
    pattern_recognition:         { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    abstraction_capacity:        { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    rule_inference:              { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    decision_tree_depth:         { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    problem_decomposition:       { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    strategy_shift:              { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    deductive_strength:          { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    inductive_strength:          { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    cognitive_rigidity:          { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    tactical_depth:              { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },

    // --- Dimension 2 — Memory & Retrieval ---
    retention_curve:             { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    recall_fidelity:             { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    recognition_bias:            { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    interference_resistance:     { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    spaced_recall_effectiveness: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    memory_decay_rate:           { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    episodic_memory_flag:        { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },

    // --- Dimension 3 — Processing Speed & Fluency ---
    mean_response_time:          { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    speed_accuracy_tradeoff:     { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    adaptive_fluency_index:      { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    cognitive_load_tolerance:    { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    reaction_variability:        { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    decision_latency:            { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    fluency_recovery_rate:       { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },

    // --- Dimension 4 — Attention & Cognitive Focus ---
    active_engagement_ratio:     { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    tab_switch_frequency:        { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    question_skipping_rate:      { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    hover_depth_index:           { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    backtracking_frequency:      { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    attention_recovery_rate:     { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    focus_decay_over_time:       { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },

    // --- Dimension 5 — Metacognition & Self-Regulation ---
    strategy_selection_score:    { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    self_correction_rate:        { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    hint_utilization_efficiency: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    planning_latency:            { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    reflective_comment_depth:    { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    retry_strategy_shift:        { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    time_reallocation_efficiency:{ type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    goal_alignment_flag:         { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },

    // --- Dimension 6 — Resilience & Adaptability ---
    persistence_score:           { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    resilience_rebound:          { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    frustration_threshold:       { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    effort_variability:          { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    strategy_adaptability:       { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    grit_trajectory:             { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    recovery_latency:            { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    plateau_breaking_score:      { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  },
  {
    schema: "cps",
    tableName: "cps_profiles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["user_id"] },
      { fields: ["context_type"] },
      { fields: ["context_ref_id"] },
      { unique: true, fields: ["user_id", "context_type", "context_ref_id"] }, // ✅ one row per context
    ],
  }
);

export { CpsProfile };
