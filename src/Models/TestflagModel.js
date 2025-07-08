// models/TabSwitchEvent.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
export const TestFlag = sequelize1.define("TestFlag", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  test_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  question_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
  type: DataTypes.STRING,
  allowNull: false,
  defaultValue: 'open',
  comment: "Status of the flag (open, in_review, resolved, dismissed)",
}

}, {
  tableName: "test_flags",
  schema: "user",
  timestamps: true,
});
