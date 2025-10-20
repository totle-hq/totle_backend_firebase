// src/Models/BookedSession.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { User } from "./UserModels/UserModel.js";
import { Session } from "./SessionModel.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";

/* -------------------------------------------------------------------------- */
/*                            BOOKED SESSION MODEL                            */
/* -------------------------------------------------------------------------- */

export const BookedSession = sequelize1.define(
  "BookedSession",
  {
    booked_session_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: "Primary key for booked sessions",
    },

    learner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "ID of the learner who booked the session",
    },

    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "ID of the teacher who owns the booked session",
    },

    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Linked topic from CatalogueNode",
    },

    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Linked session slot",
    },

    status: {
      type: DataTypes.ENUM(
        "initiated",
        "paid",
        "confirmed",
        "cancelled",
        "refunded"
      ),
      allowNull: false,
      defaultValue: "initiated",
      comment: "Booking/payment state",
    },

    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "user",
    tableName: "booked_sessions",
    timestamps: true,
  }
);

/* -------------------------------------------------------------------------- */
/*                                 ASSOCIATIONS                               */
/* -------------------------------------------------------------------------- */

if (!BookedSession.associations?.learner) {
  BookedSession.belongsTo(User, {
    foreignKey: "learner_id",
    as: "learner",
  });
}

if (!BookedSession.associations?.teacher) {
  BookedSession.belongsTo(User, {
    foreignKey: "teacher_id",
    as: "teacher",
  });
}

if (!BookedSession.associations?.session) {
  BookedSession.belongsTo(Session, {
    foreignKey: "session_id",
    as: "session",
  });
}

if (!BookedSession.associations?.topic) {
  BookedSession.belongsTo(CatalogueNode, {
    foreignKey: "topic_id",
    as: "topic",
  });
}
