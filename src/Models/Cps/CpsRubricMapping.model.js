// src/Models/Cps/CpsRubricMapping.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Detailed per-parameter weights for each question.
 * Normalized at inference time to compute 47 parameter scores.
 */
export const CpsRubricMapping = sequelize1.define(
  "CpsRubricMapping",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    question_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK → CpsQuestionBank.id",
    },
    parameter_name: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "One of the 47 CPS parameters.",
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: "Relative contribution; typically ∈ [0,1]. Sum across params may be 1.0.",
    },
  },
  {
    schema: "cps",
    tableName: "cps_rubric_mapping",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["question_id"] },
      { fields: ["parameter_name"] },
    ],
    comment: "Fine-grained mapping from question to CPS parameters.",
  }
);
