// models/survey.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const Survey = sequelize1.define('Survey', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  title: {
    type: DataTypes.STRING,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'admin', // Public schema
  tableName: 'surveys', // Table name
});

export {Survey};
