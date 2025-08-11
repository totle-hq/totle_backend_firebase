// models/feedbacksummaryModel.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";



export const FeedbackSummary = sequelize1.define("feedback_summary", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  node_id: {
    type: DataTypes.UUID, // topic, subject, or domain
    allowNull: false,
  },
  node_type: {
    type: DataTypes.ENUM("topic", "subject", "domain"),
    allowNull: false,
  },
  avg_star_rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  avg_clarity_rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  avg_helpfulness_rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  feedback_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  confidence_gain_percent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  engagement_percent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  pace_fast: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  pace_normal: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  pace_slow: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  schema: "admin",
  tableName: "feedback_summary",
  timestamps: true,
});
