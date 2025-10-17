// src/Models/CpsModels/IQChoice.model.js
// ----------------------------------------------------------------------------
// IQChoice (cps.iq_choices)
// ----------------------------------------------------------------------------

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const IQChoice = sequelize1.define(
  "IQChoice",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Choice text cannot be empty." },
      },
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    schema: "cps",
    tableName: "iq_choices",
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ["questionId"] },
      { fields: ["isCorrect"] },
    ],
    defaultScope: {
      order: [["createdAt", "ASC"]],
    },
  }
);
