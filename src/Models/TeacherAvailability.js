// models/TeacherAvailability.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";


const TeacherAvailability = sequelize1.define("TeacherAvailability", {
  availability_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  day_of_week: {
    type: DataTypes.ENUM("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"),
    allowNull: false,
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  is_recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  available_date: {
    type: DataTypes.DATEONLY,
    allowNull: true, // Only required for is_recurring: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }


}, {
  schema: "user",
  tableName: "teacher_availabilities",
  timestamps: true,
});

export default TeacherAvailability;
