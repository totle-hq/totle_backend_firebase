import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const TeacherAvailabilityTopic = sequelize1.define(
  "TeacherAvailabilityTopic",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    availability_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: {
          schema: "user",
          tableName: "teacher_availabilities",
        },
        key: "availability_id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: {
          schema: "catalog",
          tableName: "catalogue_nodes",
        },
        key: "node_id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  },
  {
    schema: "user",
    tableName: "teacher_availability_topics",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["availability_id", "topic_id"],
      },
      { fields: ["availability_id"] },
      { fields: ["topic_id"] },
    ],
  }
);
