// models/user.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const User = sequelize1.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
  },
  mobile: {
    type: DataTypes.STRING,
    unique: true,
  },
  status: {
    type: DataTypes.STRING,
  },
}, {
  schema: 'private', // Private schema
  tableName: 'users', // Table name
});

export {User};
