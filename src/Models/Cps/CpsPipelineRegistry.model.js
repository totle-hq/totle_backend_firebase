// src/Models/Cps/CpsPipelineRegistry.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Dynamic registry of pipelines used in generation/validation.
 * Lets you add new pipelines without schema changes.
 */
export const CpsPipelineRegistry = sequelize1.define(
  "CpsPipelineRegistry",
  {
    pipeline_name: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      comment: "Unique pipeline identifier (e.g., core_generator, filler_generator)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    schema: "cps",
    tableName: "cps_pipeline_registry",
    timestamps: true,
    underscored: true,
    comment: "Dynamic registry of CPS generation/validation pipelines.",
  }
);
