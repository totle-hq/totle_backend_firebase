// src/Models/Cps/CpsGenerationLog.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Per-question generation log (granular).
 * Stores prompts (sanitized), outputs, token usage, timings.
 * batch_id is SERIAL in the first log row per batch; other rows share it.
 */
export const CpsGenerationLog = sequelize1.define(
  "CpsGenerationLog",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    // Batch identity (serial-like, monotonic). Use a dedicated sequence in migrations.
    batch_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: "Monotonic serial for each end-to-end generation run.",
    },
    generation_batch_key: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: "Readable key with timestamp + serial (e.g., 20251010T154512-000123).",
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "User for whom generation is being prepared (nullable for global pre-gen).",
    },
    dimension: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    pipeline_name: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },

    // AI call telemetry (sanitize sensitive content!)
    prompt_snippet: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Small excerpt of prompt for debugging (no PII).",
    },
    output_json: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Raw parsed output from GPT-4o-mini for this item (or array slice).",
    },
    tokens_prompt: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tokens_completion: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Linking to persisted bank item (if accepted)
    question_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "FK → CpsQuestionBank.id if item made it into the bank.",
    },

    status: {
      type: DataTypes.ENUM("accepted", "rejected", "fallback_used", "retrying"),
      allowNull: false,
      defaultValue: "retrying",
    },
    rejection_reason: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
  },
  {
    schema: "cps",
    tableName: "cps_generation_logs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["batch_id"] },
      { fields: ["generation_batch_key"] },
      { fields: ["user_id"] },
      { fields: ["dimension"] },
      { fields: ["pipeline_name"] },
      { fields: ["status"] },
      { fields: ["question_id"] },
    ],
    comment: "Per-question generation logs for CPS IQ test pipeline.",
  }
);
