// src/Models/ProjectModels/ProjectTask.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const ProjectTask = sequelize1.define(
  "ProjectTask",
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
    assignee: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      defaultValue: "Backlog",
    },
    boardId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "project_tasks",
    schema: "public",   // ✅ force into public
    timestamps: true,
  }
);
