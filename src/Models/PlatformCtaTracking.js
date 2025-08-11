import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

const PlatformCtaTracking = sequelize1.define("PlatformCtaTracking", {
  userEmail: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  buttonName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pageName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  clickedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
},{
  schema: "admin",
  tableName: "platform_cta_tracking",
  timestamps: true,
  createdAt: "createdAt",
  updatedAt: "updatedAt",
}
);

export default PlatformCtaTracking;