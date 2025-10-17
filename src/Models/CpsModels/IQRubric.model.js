// src/Models/CpsModels/IQRubric.model.js
// ----------------------------------------------------------------------------
// IQRubric (cps.iq_rubrics) — data hygiene + uniqueness per choice/parameter
// ----------------------------------------------------------------------------

import { DataTypes, Deferrable } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const IQRubric = sequelize1.define(
  "IQRubric",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    // FK to cps.iq_choices.id (association wired in Models/index.js)
    choiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { tableName: "iq_choices", schema: "cps" },
        key: "id",
        deferrable: Deferrable.INITIALLY_IMMEDIATE,
      },
    },

    // e.g., "pattern_recognition"
    parameter: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Rubric parameter is required." },
        len: {
          args: [1, 200],
          msg: "Rubric parameter is too long.",
        },
      },
      set(val) {
        const v = val == null ? "" : String(val);
        // normalize to lowercase, trimmed
        this.setDataValue("parameter", v.trim().toLowerCase());
      },
    },

    value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Rubric value must be >= 0.",
        },
        max: {
          args: [100],
          msg: "Rubric value must be <= 100.",
        },
        isFinite(value) {
          if (!Number.isFinite(value)) {
            throw new Error("Rubric value must be a finite number.");
          }
        },
      },
    },
  },
  {
    schema: "cps",
    tableName: "iq_rubrics",
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ["choiceId"] },
      { fields: ["parameter"] },
      // Prevent duplicate parameter rows per choice
      { unique: true, fields: ["choiceId", "parameter"] },
    ],
  }
);
