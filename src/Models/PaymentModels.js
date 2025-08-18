import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const Payment = sequelize1.define("Payment", {
  payment_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  // The type of entity being paid for (session/test)
  entity_type: {
    type: DataTypes.ENUM("session", "test"),
    allowNull: false,
  },

  entity_id: {
    type: DataTypes.UUID,
    allowNull: false, // session_id or test_id
  },

  order_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  razorpay_payment_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  razorpay_signature: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  amount: {
    type: DataTypes.INTEGER, // in paise (e.g., 1000 = ₹10)
    allowNull: false,
  },

  currency: {
    type: DataTypes.STRING,
    defaultValue: "INR",
  },

  status: {
    type: DataTypes.ENUM("created", "pending", "success", "failed", "refunded"),
    defaultValue: "created",
  },

  failure_reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  schema: "user",
  tableName: "payments",
  timestamps: true,
});
