import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

// src/Models/QuestionPool.model.js
export const QuestionPool = sequelize1.define(
  "QuestionsPool",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    topic_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    dimension: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    question: {
      type: DataTypes.JSONB,
      allowNull: false, // { text, options }
    },
    correct_answer: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    is_buffer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    source_test_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    usage_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    schema: "user",
    tableName: "questionsPool",
    timestamps: true,
    indexes: [
      { fields: ["topic_uuid", "dimension"] },
      { fields: ["topic_uuid", "dimension", "usage_count"] },
    ],
  }
);
