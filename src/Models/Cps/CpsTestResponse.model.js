// src/Models/Cps/CpsTestResponse.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Stores each answer the user selected with optional confidence & time spent.
 * Used to compute the 47-parameter vector and 6 dimension scores.
 */
export const CpsTestResponse = sequelize1.define(
  "CpsTestResponse",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK → CpsTestSession.id",
    },
    question_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK → CpsQuestionBank.id",
    },
    chosen_option: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 3 },
    },
    // Optional metacognition signal
    confidence: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: "User's self-reported confidence (0-100).",
    },
    time_spent_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    schema: "cps",
    tableName: "cps_test_responses",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["session_id"] },
      { fields: ["question_id"] },
    ],
    comment: "Per-question responses for a given IQ test session.",
  }
);
