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
});

export default PlatformCtaTracking;