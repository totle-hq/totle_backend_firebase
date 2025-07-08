// models/TabSwitchEvent.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const TabSwitchEvent = sequelize1.define("TabSwitchEvent", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  test_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING, // e.g., "TAB_SWITCH", "RELOAD", "FULLSCREEN_EXIT"
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "tab_switch_events",
  schema: "user",
  timestamps: true
});
