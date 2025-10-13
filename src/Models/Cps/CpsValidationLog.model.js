// src/Models/Cps/CpsValidationLog.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Records validator findings: duplicates, malformed JSON, rubric gaps, etc.
 */
export const CpsValidationLog = sequelize1.define(
  "CpsValidationLog",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    batch_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    generation_batch_key: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    question_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    dimension: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    validator_name: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "validator_pass",
    },
    issue_code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "E.g., DUPLICATE_SEMANTIC, MALFORMED_JSON, RUBRIC_GAP",
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    schema: "cps",
    tableName: "cps_validation_logs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["batch_id"] },
      { fields: ["generation_batch_key"] },
      { fields: ["question_id"] },
      { fields: ["dimension"] },
      { fields: ["validator_name"] },
      { fields: ["issue_code"] },
      { fields: ["resolved"] },
    ],
    comment: "Validator findings for CPS question generation.",
  }
);
