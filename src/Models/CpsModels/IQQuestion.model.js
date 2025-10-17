// src/Models/CpsModels/IQQuestion.model.js
// ----------------------------------------------------------------------------
// IQQuestion (cps.iq_questions)
// ----------------------------------------------------------------------------

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const IQQuestion = sequelize1.define(
  "IQQuestion",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    questionText: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: {
          args: [10, 10000],
          msg: "Question text must be at least 10 characters.",
        },
      },
    },
    // Keep as TEXT for flexibility; enforce via app constants if needed.
    dimension: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true, // Optional FK to user.User.id (not enforced here)
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    schema: "cps",
    tableName: "iq_questions",
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ["dimension"] },
      { fields: ["isActive", "createdAt"] },
    ],
    defaultScope: {
      where: {},
      order: [["createdAt", "DESC"]],
    },
    scopes: {
      active: { where: { isActive: true } },
      byDimension(dim) {
        return { where: { dimension: dim } };
      },
      withAll() {
        return {
          include: [
            {
              association: "choices",
              include: [{ association: "rubrics" }],
              order: [["createdAt", "ASC"]],
            },
          ],
        };
      },
    },
  }
);
