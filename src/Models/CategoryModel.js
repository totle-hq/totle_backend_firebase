// category.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

const Category = sequelize1.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the category (e.g., "JEE Mains & Advanced")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the category
  },
}, {
  schema: 'catalog',   // Correctly specifying the schema
  tableName: 'category',  // Correctly specifying the table name
});

export { Category };
