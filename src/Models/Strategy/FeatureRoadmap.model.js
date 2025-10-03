import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js"; // adjust import if your instance is named differently

// Feature Roadmap Model
export const FeatureRoadmap = sequelize1.define(
  "FeatureRoadmap",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    addedBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastModified: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0, // auto-adjusted when inserting/reordering
    },
    status: {
      type: DataTypes.ENUM("Planned", "In Progress", "Shipped"),
      defaultValue: "Planned",
    },
  },
  {
    schema: "user", // ✅ you are using schema "user" everywhere
    tableName: "FeatureRoadmap",
    timestamps: true,
    indexes: [
      {
        fields: ["priority"],
      },
    ],
  }
);
