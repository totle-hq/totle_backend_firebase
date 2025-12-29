import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * NucleusDocFolder
 * ----------------
 * Represents a hierarchical folder inside Nucleus Documentation.
 * Folder tree is department-scoped.
 */

export const NucleusDocFolder = sequelize1.define(
  "NucleusDocFolder",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    department_code: {
      type: DataTypes.STRING, // e.g. "Manhattan"
      allowNull: false,
    },

    parent_id: {
      type: DataTypes.UUID,
      allowNull: true, // null = root folder
    },

    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    created_by: {
      type: DataTypes.UUID,
      allowNull: false, // adminId
    },

    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "admin",
    tableName: "nucleus_doc_folders",
    timestamps: true,
    indexes: [
      {
        fields: ["department_code"],
      },
      {
        fields: ["parent_id"],
      },
    ],
  }
);
