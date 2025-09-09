// File: src/Models/PaymentModels.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js"; // adjust path if needed

export const Payment = sequelize1.define(
  "Payment",
  {
    payment_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // what the payment is for (we use "test")
    entity_type: {
      type: DataTypes.STRING(32), // keep STRING to avoid ENUM migration requirements
      allowNull: false,
    },

    // id of the thing being paid for (topicId for tests)
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    order_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },

    razorpay_payment_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },

    razorpay_signature: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },

    amount: {
      type: DataTypes.INTEGER, // paise
      allowNull: false,
    },

    currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: "INR",
    },

    status: {
      type: DataTypes.STRING(16), // "created" | "success" | "failed" | "refunded"
      allowNull: false,
      defaultValue: "created",
    },

    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // IMPORTANT: do NOT define session_id here
  },
  {
    tableName: "payments",
    schema: "user",
    timestamps: true,      // generates createdAt / updatedAt
    underscored: false,    // keeps camelCase (createdAt/updatedAt)
    freezeTableName: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["entity_type", "entity_id"] },
      { unique: true, fields: ["order_id"] },
      { fields: ["status"] },
      { fields: ["createdAt"] },
    ],
  }
);
