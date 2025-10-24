import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

const SyncEmail = sequelize1.define(
  "SyncEmail",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "sync_emails",
    schema: "admin",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
    ],
    scopes: {
      active: {
        where: { is_active: true },
      },
    },
  }
);

// Optional helper for OTP guard
SyncEmail.isAllowed = async (email) => {
  const record = await SyncEmail.findOne({ where: { email, is_active: true } });
  return Boolean(record);
};

export default SyncEmail;
