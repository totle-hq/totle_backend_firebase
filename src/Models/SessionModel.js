import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
export const Session = sequelize1.define(
  "Session",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
      completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "available",
    },
  },
  {
    schema: "user",
    tableName: "sessions",
    timestamps: true, // ✅ Ensure timestamps are enabled
  }
);

Session.belongsTo(CatalogueNode, {
  foreignKey: "topic_id",
  as: "topic",
});