// src/Models/ProjectModels/ProjectBoard.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const ProjectBoard = sequelize1.define(
  "ProjectBoard",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    createdBy: DataTypes.STRING,
    department: DataTypes.STRING,
  },
  {
    tableName: "project_boards",
    schema: "public",   // ✅ force into public
    timestamps: true,
  }
);
