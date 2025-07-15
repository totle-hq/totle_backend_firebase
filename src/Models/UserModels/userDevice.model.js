// src/Models/UserModels/userDevice.model.js

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";
import { User } from "./UserModel.js";

export const UserDevice = sequelize1.define("UserDevice", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true, // ✅ Ensures one active device per user
    references: {
      model: User,
      key: "id"
    }
  },
  fingerprint: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Unique device/browser fingerprint",
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "User's IP address",
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Browser and device information",
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Manually entered city (optional)",
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: "Latitude (if available from frontend)",
  },
  lng: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: "Longitude (if available from frontend)",
  },
   is_in_session: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
}
}, {
  tableName: "user_devices",
  schema: "user",
  timestamps: true,
});
