import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * NucleusDocument
 * ---------------
 * Actual documentation content.
 * Belongs to a folder and a department.
 */

export const NucleusDocument = sequelize1.define(
  "NucleusDocument",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    content: {
      type: DataTypes.TEXT, // markdown / rich text (TipTap later)
      allowNull: true,
    },

    folder_id: {
      type: DataTypes.UUID,
      allowNull: true, // allow root-level docs
    },

    department_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },

    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "admin",
    tableName: "nucleus_documents",
    timestamps: true,
    indexes: [
      {
        fields: ["department_code"],
      },
      {
        fields: ["folder_id"],
      },
    ],
  }
);
