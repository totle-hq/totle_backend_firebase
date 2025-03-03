import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js"; // Ensure correct Sequelize instance

const MarketplaceSuggestion = sequelize1.define(
  "MarketplaceSuggestion",
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
        model: "users", // Ensures the suggestion is linked to users table
        key: "id",
      },
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    schema: "user", // ✅ Stored under the `user` schema
    tableName: "suggestions",
    timestamps: true,
  }
);

export { MarketplaceSuggestion };
