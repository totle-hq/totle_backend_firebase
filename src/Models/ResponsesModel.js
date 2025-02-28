import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

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
        model:  { schema: "user", tableName: "users" }, // Reference Users table in user schema
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
    answer: {
      type: DataTypes.STRING, // Store selected option, rating, or text response
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "user", // Store Responses in "user" schema
    tableName: "responses", // Table name
  }
);

export { Responses };
