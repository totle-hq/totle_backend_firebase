import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const ModerationFlag = sequelize1.define("moderation_flags", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  sessionId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  reporterId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: "Who reported (teacher, learner, or system)"
  },

  reason: {
    type: DataTypes.ENUM(
      "learner-no-show",
      "teacher-no-show",
      "misconduct",
      "technical-issue",
      "incomplete",
      "other"
    ),
    allowNull: false
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Detailed explanation or comments"
  },

  status: {
    type: DataTypes.ENUM("open", "in-review", "resolved"),
    defaultValue: "open",
    allowNull: false
  }

}, {
  schema: "admin",
  tableName: "moderation_flags",

  timestamps: true
});
