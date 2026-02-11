// src/Models/TeacherAvailability.js

import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const TeacherAvailability = sequelize1.define(
  "TeacherAvailability",
  {
    availability_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    start_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    end_at: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isAfterStart(value) {
          if (new Date(value) <= new Date(this.start_at)) {
            throw new Error("end_at must be greater than start_at");
          }
        },
      },
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    schema: "user",
    tableName: "teacher_availabilities",
    timestamps: true,
    indexes: [
      { fields: ["teacher_id", "start_at"] },
      { fields: ["teacher_id", "end_at"] },
    ],
  }
);

export default TeacherAvailability;
