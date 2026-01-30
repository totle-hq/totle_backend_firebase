// src/models/promoCode.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";


export const PromoCode = sequelize1.define(
  "PromoCode",
  {
    code: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },

    discount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    type: {
      type: DataTypes.ENUM("percentage", "amount"),
      allowNull: false,
    },

    usage_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    used_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    audience: {
        type: DataTypes.ENUM("all", "user_specific", "teacher", "learner","public"),
        defaultValue: "all"
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },


    min_order_value: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    is_stackable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    schema: "user",
    tableName: "promo_codes",
    timestamps: true,
    indexes: [
      { fields: ["audience"] },
      { fields: ["user_id"] },
      { fields: ["expires_at"] },
      { fields: ["is_active"] },
    ],
  }
);