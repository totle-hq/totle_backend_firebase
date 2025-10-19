// src/Models/BookedSession.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { Session } from "./SessionModel.js";

export const BookedSession = sequelize1.define(
  "BookedSession",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // who/what
    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Teacher who will deliver the session",
    },
    learner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Learner who booked",
    },
    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "CatalogueNode id",
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Denormalized topic name snapshot at booking time",
    },

    // link to concrete session slot (can be null while payment pending)
    session_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment:
        "References user.sessions.session_id once a concrete slot is reserved",
    },

    // (Optional) booking lifecycle; keep if you need it here
    status: {
      type: DataTypes.ENUM("initiated", "paid", "confirmed", "cancelled", "refunded"),
      allowNull: false,
      defaultValue: "initiated",
      comment: "Booking/payment state",
    },
  },
  {
    schema: "user",
    tableName: "booked_sessions",
    timestamps: true,

    indexes: [
      // fast lookups
      { name: "booked_sessions_session_idx", fields: ["session_id"] },
      { name: "booked_sessions_teacher_idx", fields: ["teacher_id", "createdAt"] },
      { name: "booked_sessions_learner_idx", fields: ["learner_id", "createdAt"] },

      // prevent double-booking the same concrete session
      // (unique WHERE session_id IS NOT NULL)
      {
        unique: true,
        name: "booked_sessions_session_unique_notnull",
        fields: ["session_id"],
        where: { session_id: { [sequelize1.Sequelize.Op.ne]: null } },
      },
    ],
  }
);

/* --------- Associations (FKs for eager-loading & integrity) --------- */

// BookedSession → Session (optional while payment pending)
BookedSession.belongsTo(Session, {
  foreignKey: "session_id",
  targetKey: "session_id",
  as: "session",
});

// You can also add belongsTo(User) for teacher/learner if your User model is available here.

/* --------- Hooks (optional, but helpful) --------- */
// If you want to ensure topic fields match the linked Session once session_id is set
BookedSession.beforeSave(async (row) => {
  if (row.session_id && (!row.topic_id || !row.topic)) {
    const s = await Session.findByPk(row.session_id, { attributes: ["topic_id"], include: [] });
    if (s) {
      row.topic_id = row.topic_id || s.topic_id;
      // If you want the name snapshot, resolve CatalogueNode name here (or in the booking service)
    }
  }
});

export default BookedSession;
