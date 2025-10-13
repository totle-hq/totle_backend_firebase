// src/Models/Cps/CpsUserQuestionLog.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * Tracks which user has been served which question(s), 
 * along with correctness, confidence, and response time.
 */
export const CpsUserQuestionLog = sequelize1.define(
  "CpsUserQuestionLog",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK → user.users.id",
    },
    question_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK → cps.cps_question_bank.id",
    },
    batch_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: "The generation batch that served this question to the user.",
    },
    /** ✅ Newly added fields for CPS aggregation **/
    is_correct: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the user answered the question correctly.",
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "User's confidence in their chosen answer (0–1 or %).",
    },
    time_spent_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Time spent answering this question, in milliseconds.",
    },
    served_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "cps",
    tableName: "cps_user_question_log",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["question_id"] },
      { unique: true, fields: ["user_id", "question_id"] },
      { fields: ["batch_id"] },
    ],
    comment: "User-question ledger for CPS scoring and fallback prevention.",
  }
);
