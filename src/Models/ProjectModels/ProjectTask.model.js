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
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'to-do',
      validate: {
        isIn: [['to-do', 'inProgress', 'done', 'review','backlog']],
      },
    },
    // ✅ New Field: Critical Level
    criticalLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'low',
    },

    // ✅ New Field: Cloudinary Image URLs
    imageUrls: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    assignedTo: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    taskNumber:{
      type: DataTypes.INTEGER,
      allowNull: true,
    }

  },
  {
    tableName: "project_tasks",
    schema: "public",   // ✅ force into public
    timestamps: true,
  }
);
