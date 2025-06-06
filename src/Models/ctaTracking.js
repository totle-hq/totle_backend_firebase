
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; 

const CtaTracking = sequelize1.define('CtaTracking', {
  pageName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  clickCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
});

export default CtaTracking;