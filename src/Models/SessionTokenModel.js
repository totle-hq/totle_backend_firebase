import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const SessionToken = sequelize1.define(
  "SessionToken",
  {
    session_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ❗ FIXED: must be UUID (not integer)
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    refresh_token_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    device: { type: DataTypes.STRING },
    ip: { type: DataTypes.STRING },
    browser: { type: DataTypes.STRING },
    os: { type: DataTypes.STRING },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },

  {
    tableName: "SessionTokens",        // ensure table name matches
    freezeTableName: true,             // disable auto-pluralization
    timestamps: true,                  // createdAt, updatedAt
  }
);
