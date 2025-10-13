// src/Models/Cps/CpsErrorLog.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Pipeline/runtime errors with stack traces for audits.
 */
export const CpsErrorLog = sequelize1.define(
  "CpsErrorLog",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    batch_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    generation_batch_key: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    pipeline_name: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    dimension: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    error_name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    stack: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    schema: "cps",
    tableName: "cps_error_logs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["batch_id"] },
      { fields: ["generation_batch_key"] },
      { fields: ["pipeline_name"] },
      { fields: ["dimension"] },
      { fields: ["error_name"] },
    ],
    comment: "Errors captured during CPS generation/validation/runtime.",
  }
);
