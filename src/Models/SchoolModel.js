// school.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Category } from './CategoryModel.js';

const School = sequelize1.define('School', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the school
  },
  categoryId: {
    type: DataTypes.INTEGER,
    references: {
      model: Category,  // Reference to the Category model
      key: 'id',
    },
    allowNull: false,  // School must have a category
  },
}, {
  schema: 'catalog',
  tableName: 'school',  // Table name for school
});



export { School };
