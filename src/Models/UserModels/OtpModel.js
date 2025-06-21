// models/otp.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js'; // Sequelize instance

const OTP = sequelize1.define('Otp', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  mobile: {
    type: DataTypes.STRING,
    unique: true,
  },
  otp: {
    type: DataTypes.INTEGER,
  },
  expiry: {
    type: DataTypes.DATE,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'user', // OTP is stored in the private schema
  tableName: 'otps',
});

export {OTP};
