// src/Models/NotificationModel.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { User } from "./UserModels/UserModel.js";

const Notification = sequelize1.define(
  "Notification",
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
        model: User,
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "session_booking",
    },
    category: {
      type: DataTypes.ENUM("all", "learn", "teach"),
      allowNull: false,
      defaultValue: "all",
    },
    priority: {
      type: DataTypes.ENUM("high", "medium", "low"),
      allowNull: true,
    },
    logo: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "/lo.jpg",
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Store additional data like session_id, teacher_id, etc.",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // ✅ FIX: Use snake_case for consistency with indexes
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at' // Explicitly set field name
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at' // Explicitly set field name
    },
  },
  {
    schema: "user",
    tableName: "notifications",
    timestamps: true, // This automatically creates createdAt and updatedAt
    createdAt: 'created_at', // ✅ Map to snake_case
    updatedAt: 'updated_at', // ✅ Map to snake_case
    indexes: [
      { fields: ["user_id"] },
      { fields: ["category"] },
      { fields: ["read"] },
      { fields: ["created_at"] }, // ✅ Use snake_case here too
    ],
  }
);

export { Notification };