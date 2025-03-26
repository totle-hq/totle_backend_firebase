// models/language.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const Language = sequelize1.define('Language', {
  language_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  language_name: {
    type: DataTypes.STRING,
    unique: true,
  },
}, {
  schema: 'user', // Public schema
  tableName: 'languages', // Table name
});

export {Language};
