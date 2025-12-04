// src/Models/UserModels/BankDetailsModel.js

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const BankDetails = sequelize1.define(
  "BankDetails",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: {
          tableName: "users",
          schema: "user",
        },
        key: "id",
      },
      onDelete: "CASCADE",
    },

    account_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    bank_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    ifsc_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    account_holder: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    account_type: {
      type: DataTypes.ENUM("savings", "current", "other"),
      allowNull: true,
      defaultValue: "savings",
    },
  },
  {
    schema: "user",
    tableName: "bank_details",
    timestamps: true,
    freezeTableName: true,
  }
);
