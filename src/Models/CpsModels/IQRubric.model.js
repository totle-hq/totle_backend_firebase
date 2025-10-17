// src/Models/CpsModels/IQRubric.model.js
// ----------------------------------------------------------------------------
// IQRubric (cps.iq_rubrics)
// ----------------------------------------------------------------------------

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const IQRubric = sequelize1.define(
  "IQRubric",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    choiceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    parameter: {
      type: DataTypes.TEXT, // e.g., "pattern_recognition"
      allowNull: false,
      validate: {
        notEmpty: { msg: "Rubric parameter is required." },
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
    ],
  }
);
