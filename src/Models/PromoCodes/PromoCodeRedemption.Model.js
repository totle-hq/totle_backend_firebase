// src/models/promoCodeRedemption.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";
import { PromoCode } from "../PromoCodes/PromoCode.Model.js";

export const PromoCodeRedemption = sequelize1.define(
  "PromoCodeRedemption",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    promo_code: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: PromoCode,
        key: "code",
      },
      onDelete: "CASCADE",
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    redeemed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "user",
    tableName: "promo_code_redemptions",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["promo_code", "user_id"], // 🔒 one-time per user
      },
    ],
  }
);
