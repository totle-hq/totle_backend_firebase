// src/Models/TeacherAvailability.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";

/* ---------------------------------------------------------------------------
   TeacherAvailability
   --------------------------------------------------------------------------- */
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
    day_of_week: {
      type: DataTypes.ENUM(
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ),
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
      allowNull: true,
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
  }
);

/* ---------------------------------------------------------------------------
   TeacherAvailabilityTopic (Join Table)
   --------------------------------------------------------------------------- */
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
      references: { model: "teacher_availabilities", key: "availability_id" },
    },
    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "catalogue_nodes", key: "node_id" },
    },
  },
  {
    schema: "user",
    tableName: "teacher_availability_topics",
    timestamps: false,
  }
);

/* ---------------------------------------------------------------------------
   Associations
   --------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   Associations (Unified alias = "catalogueNode")
   --------------------------------------------------------------------------- */
TeacherAvailability.belongsToMany(CatalogueNode, {
  through: TeacherAvailabilityTopic,
  foreignKey: "availability_id",
  otherKey: "topic_id",
  as: "catalogueNode", // unified alias across all models
});

CatalogueNode.belongsToMany(TeacherAvailability, {
  through: TeacherAvailabilityTopic,
  foreignKey: "topic_id",
  otherKey: "availability_id",
  as: "teacherAvailability",
});


export default TeacherAvailability;
