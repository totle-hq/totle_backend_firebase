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
  duration_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    comment: "Duration of the session",
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: "completed", // or "upcoming", "cancelled"
  },
});
