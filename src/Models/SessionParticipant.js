import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const SessionParticipant = sequelize1.define(
  "SessionParticipant",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM("teacher", "learner"),
      allowNull: false,
    },

    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    left_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "session_participants",
    schema: "user",
    timestamps: true,
    indexes: [
      { fields: ["session_id"] },
      { fields: ["user_id"] },
    ],
  }
);

// Associations defined in associations.js
export default SessionParticipant;
