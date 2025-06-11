import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; 

const CtaTracking = sequelize1.define('CtaTracking', {
  pageName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  buttonName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clickCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['pageName', 'buttonName'],
    },
  ],
});

export default CtaTracking;
