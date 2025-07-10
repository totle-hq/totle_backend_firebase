
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const SupportQueryMaster = sequelize1.define(
  "SupportQueryMaster",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order:{
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, // Default order value
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    schema: "admin",
    tableName: "support_queries_master",
    timestamps: true,
    underscored: true,
  }
);


