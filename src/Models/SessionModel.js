// src/Models/SessionModel.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
import { Teachertopicstats } from "./TeachertopicstatsModel.js";
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
      session_tier: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "free", 
      validate: {
        isIn: [['free', 'paid']] 
      }
    },
    session_level: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Bridger" 
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
Session.beforeCreate(async (session) => {
  try {

    const teacherStats = await Teachertopicstats.findOne({
      where: {
        teacher_id: session.teacher_id,
        node_id: session.topic_id
      },
      attributes: ['tier', 'level'],
      raw: true
    });

    if (teacherStats) {

      session.session_tier = teacherStats.tier || 'free';
      session.session_level = teacherStats.level || 'Bridger';
    }
 
  } catch (error) {
    console.error('Error in beforeCreate hook:', error);
  
  }
});