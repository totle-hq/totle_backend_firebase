// src/Models/SessionModel.js
// -----------------------------------------------------------------------------
// TOTLE Session Model (Final Fixed Version)
// -----------------------------------------------------------------------------

import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
import { Teachertopicstats } from "./TeachertopicstatsModel.js";
import { User } from "./UserModels/UserModel.js";

/* -----------------------------------------------------------------------------
   Model Definition
 ----------------------------------------------------------------------------- */

export const Session = sequelize1.define(
  "Session",
  {
    session_id: {
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
      comment: "Timestamp when the session was completed (actual end time)",
    },

    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, isInt: true },
      comment: "Planned or actual session duration in minutes",
    },

    session_tier: {
      type: DataTypes.ENUM("free", "paid"),
      allowNull: false,
      defaultValue: "free",
      comment: "Tier of the session (free/paid)",
    },

    session_level: {
      type: DataTypes.ENUM("Bridger", "Expert", "Master", "Legend"),
      allowNull: false,
      defaultValue: "Bridger",
      comment: "Level of the session",
    },

    status: {
      type: DataTypes.ENUM("available", "booked", "upcoming", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "available",
      comment: "Lifecycle status of the session",
    },

    // ---- Virtual computed end time ----
    planned_end_at: {
      type: DataTypes.VIRTUAL,
      get() {
        const start = this.getDataValue("scheduled_at");
        const mins = Number(this.getDataValue("duration_minutes") || 0);
        if (!start || !mins) return null;
        return new Date(new Date(start).getTime() + mins * 60000);
      },
      comment: "Computed end time = scheduled_at + duration_minutes (not persisted)",
    },
  },
  {
    schema: "user",
    tableName: "sessions",
    timestamps: true,
    comment:
      "Stores all teacher–learner sessions with scheduling, tier, and status metadata",
    indexes: [
      { name: "sessions_teacher_start_idx", fields: ["teacher_id", "scheduled_at"] },
      {
        name: "sessions_teacher_level_start_idx",
        fields: ["teacher_id", "session_level", "scheduled_at"],
      },
    ],
  }
);

/* -----------------------------------------------------------------------------
   Associations
 ----------------------------------------------------------------------------- */

// Session → Topic (each session belongs to one CatalogueNode topic)
Session.belongsTo(CatalogueNode, {
  foreignKey: "topic_id",
  as: "topic",
});

// 🔁 Compatibility alias for legacy controllers
Session.belongsTo(CatalogueNode, {
  foreignKey: "topic_id",
  as: "Topic",
});


// Session → TeacherTopicStats (for level/tier linkage)
Session.belongsTo(Teachertopicstats, {
  foreignKey: "teacher_id", // column on Session
  targetKey: "teacherId", // attribute on Teachertopicstats
  as: "teacherTopicStats",
});

// Session → Teacher (User)
Session.belongsTo(User, {
  foreignKey: "teacher_id",
  as: "teacher",
});

// Session → Student (User)
Session.belongsTo(User, {
  foreignKey: "student_id",
  as: "student",
});

/* ---------------- Inverse Associations (critical for proper JOINs) ---------------- */

// User → Sessions taught
User.hasMany(Session, {
  foreignKey: "teacher_id",
  as: "sessionsTaught",
});

// User → Sessions attended
User.hasMany(Session, {
  foreignKey: "student_id",
  as: "sessionsAttended",
});

// CatalogueNode → Sessions
CatalogueNode.hasMany(Session, {
  foreignKey: "topic_id",
  as: "sessions",
});

/* -----------------------------------------------------------------------------
   Hooks
 ----------------------------------------------------------------------------- */
/**
 * Auto-fill session_tier & session_level from teacher’s topic stats at creation.
 * This ensures consistency between a teacher’s tier/level and session attributes.
 */
Session.beforeCreate(async (session) => {
  try {
    const teacherStats = await Teachertopicstats.findOne({
      where: {
        teacherId: session.teacher_id,
        node_id: session.topic_id,
      },
      attributes: ["tier", "level"],
      raw: true,
    });

    if (teacherStats) {
      session.session_tier = teacherStats.tier || "free";
      session.session_level = teacherStats.level || "Bridger";
    } else {
      session.session_tier = "free";
      session.session_level = "Bridger";
    }
  } catch (error) {
    console.error("❌ Error in Session.beforeCreate hook:", error);
    if (!session.session_tier) session.session_tier = "free";
    if (!session.session_level) session.session_level = "Bridger";
  }
});

export default Session;
