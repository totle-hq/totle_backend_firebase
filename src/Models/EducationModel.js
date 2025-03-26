// college.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Category } from './CategoryModel.js';

const Education = sequelize1.define('Education', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the college
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false, 
    references: {
      model: Category,
      key: 'id',
    },
  },
}, {
  schema: 'catalog',
  tableName: 'education',  // Table name for college
});

export { Education };

