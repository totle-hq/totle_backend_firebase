// src/Models/TeacherAvailability.js

import { DataTypes, Op } from "sequelize";
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

    topic_id: {
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
          if (!this.start_at) return;

          const start = new Date(this.start_at);
          const end = new Date(value);

          if (end <= start) {
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
      {
        name: "idx_teacher_time",
        fields: ["teacher_id", "start_at", "end_at"],
      },
      {
        name: "idx_teacher_topic",
        fields: ["teacher_id", "topic_id"],
      },
    ],

    hooks: {
      async beforeCreate(instance) {
        await validateAvailabilityOverlap(instance);
      },

      async beforeUpdate(instance) {
        await validateAvailabilityOverlap(instance);
      },
    },
  }
);

/**
 * Prevent overlapping availability for the same teacher,
 * even across different topics.
 */
async function validateAvailabilityOverlap(instance) {
  const TeacherAvailabilityModel =
    sequelize1.models.TeacherAvailability;

  const overlapping = await TeacherAvailabilityModel.findOne({
    where: {
      teacher_id: instance.teacher_id,

      // Exclude current record during update
      availability_id: {
        [Op.ne]: instance.availability_id,
      },

      is_active: true,

      // Overlap condition
      start_at: {
        [Op.lt]: instance.end_at,
      },
      end_at: {
        [Op.gt]: instance.start_at,
      },
    },
  });

  if (overlapping) {
    throw new Error(
      "Teacher already has availability during this time range"
    );
  }
}

export default TeacherAvailability;
