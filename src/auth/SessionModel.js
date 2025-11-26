import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const UserSession = sequelize1.define("UserSession", {
  session_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  refresh_token_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_agent: {
    type: DataTypes.STRING,
  },
  ip_address: {
    type: DataTypes.STRING,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  tableName: "user_sessions",
  timestamps: false,
});
