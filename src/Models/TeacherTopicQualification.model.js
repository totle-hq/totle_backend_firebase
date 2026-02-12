import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { User } from "./UserModels/UserModel.js";
import { CatalogueNode } from "./CatalogueNode.model.js";

export const TeacherTopicQualification = sequelize1.define(
  "TeacherTopicQualification",
  {
    qualification_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { schema: "user", tableName: "users" },
        key: "id",
      },
      onDelete: "CASCADE",
    },

    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { schema: "catalog", tableName: "catalogue_nodes" },
        key: "node_id",
      },
      onDelete: "CASCADE",
    },

    exam_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    passed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    certification_level: {
      type: DataTypes.ENUM("basic", "advanced", "expert"),
      allowNull: true,
    },

    passed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    schema: "user",
    tableName: "teacher_topic_qualifications",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["teacher_id", "topic_id"],
      },
      {
        fields: ["teacher_id"],
      },
      {
        fields: ["topic_id"],
      },
      {
        fields: ["passed"],
      },
    ],
  }
);
