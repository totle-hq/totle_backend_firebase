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
    comment: "Reference to the user making the payment",
  },

  // 🔄 Strict FK to Session (optional: only if payment is for a session)
  session_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: {
        tableName: "sessions",
        schema: "user",
      },
      key: "session_id",
    },
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
    comment: "Reference to a session if this payment was for a session",
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
  comment: "Stores all payment transactions (session or test)",
});
