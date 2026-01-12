// models/ApiUsage.model.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const ApiUsage = sequelize1.define("ApiUsage", {
  month: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  monthly_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: "apiUsage",
  schema: "admin",
  timestamps: true,
});
