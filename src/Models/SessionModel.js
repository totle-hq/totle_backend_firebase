import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const Session = sequelize1.define("Session", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: "User ID of the teacher",
  },

  student_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "User ID of the student (optional for public sessions)",
  },

  topic_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: "ID of the topic taught",
  },

  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: "Scheduled date/time for the session",
  },

  joined_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  duration_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    comment: "Duration of the session",
  },

  platform: {
    type: DataTypes.STRING,
  },

  learner_name: {
    type: DataTypes.STRING,
  },

 status: {
  type: DataTypes.STRING,
  defaultValue: "available",
},

  feedback_rating: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },

  feedback_comment: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  feedback_submitted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }

});

