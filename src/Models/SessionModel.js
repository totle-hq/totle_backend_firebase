// src/Models/SessionModel.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
import { Teachertopicstats } from "./TeachertopicstatsModel.js";

export const Session = sequelize1.define(
  "Session",
  {
    session_id: {   // 🔄 renamed from "id" to align with Payment.session_id FK
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: "Primary key for sessions",
    },
    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Reference to the teacher conducting the session",
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Reference to the learner attending the session (nullable until booked)",
    },
    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Reference to the CatalogueNode (topic) this session is for",
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Scheduled start time of the session",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when the session was completed",
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Planned or actual session duration in minutes",
    },
    session_tier: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "free",
      validate: { isIn: [["free", "paid"]] },
      comment: "Tier of the session (free/paid)",
    },
    session_level: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Bridger",
      comment: "Level of the session (Bridger, Expert, Master, etc.)",
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "available",
      comment: "Lifecycle status of the session (available, booked, completed, etc.)",
    },
  },
  {
    schema: "user",
    tableName: "sessions",
    timestamps: true, // ✅ Ensure created_at & updated_at are present
    comment: "Stores all teacher–learner sessions with scheduling, tier, and status metadata",
  }
);

// 🔗 Link Session to CatalogueNode
Session.belongsTo(CatalogueNode, {
  foreignKey: "topic_id",
  as: "topic",
});

// ⚡ Auto-fill session_tier & session_level from teacher’s topic stats
Session.beforeCreate(async (session) => {
  try {
    const teacherStats = await Teachertopicstats.findOne({
      where: {
        teacher_id: session.teacher_id,
        node_id: session.topic_id,
      },
      attributes: ["tier", "level"],
      raw: true,
    });

    if (teacherStats) {
      session.session_tier = teacherStats.tier || "free";
      session.session_level = teacherStats.level || "Bridger";
    }
  } catch (error) {
    console.error("❌ Error in Session.beforeCreate hook:", error);
  }
});
