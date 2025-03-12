// college.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Category } from './CategoryModel.js';

const College = sequelize1.define('College', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the college
  },
  categoryId: {
    type: DataTypes.INTEGER,
    references: {
      model: Category,  // Reference to the Category model
      key: 'id',
    },
    allowNull: false,  // College must have a category
  },
}, {
  schema: 'catalog',
  tableName: 'college',  // Table name for college
});

export { College };

