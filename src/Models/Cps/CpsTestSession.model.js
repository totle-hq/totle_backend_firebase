// src/Models/Cps/CpsTestSession.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * One IQ test attempt per user (for CPS IQ test context).
 * Stores lifecycle timestamps and completion state.
 */
export const CpsTestSession = sequelize1.define(
  "CpsTestSession",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // Optional link to generation batch that constructed the question set
    batch_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    generation_batch_key: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("started", "abandoned", "completed"),
      allowNull: false,
      defaultValue: "started",
    },
    // Optional UX telemetry
    device_info: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    schema: "cps",
    tableName: "cps_test_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["batch_id"] },
      { fields: ["status"] },
    ],
    comment: "IQ test sessions (per user attempt) for CPS.",
  }
);
