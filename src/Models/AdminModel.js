// models/admin.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const Admin = sequelize1.define('Admin', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'admin', // Private schema
  tableName: 'admins', // Table name
});

export  {Admin};
