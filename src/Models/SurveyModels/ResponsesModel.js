import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js'; // Use the main DB connection

const Responses = sequelize1.define(
  "Response",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { schema: "user", tableName: "users" }, // Reference Users table
        key: "id",
      },
    },
    surveyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { schema: "admin", tableName: "surveys" },
        key: "id",
      },
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { schema: "user", tableName: "questions" },
        key: "id",
      },
    },
    statusSubmitted:{
      type: DataTypes.ENUM("pending", "submitted"),
      defaultValue: "pending",
    },
    answer: {
      type: DataTypes.JSON, // ✅ Store multiple answers in an array format
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "user",
    tableName: "responses",
  }
);

export { Responses };
