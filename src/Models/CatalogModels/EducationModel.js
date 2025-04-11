// college.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { Category } from './CategoryModel.js';

const Education = sequelize1.define('Education', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the college
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,  // Description of the college
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.UUID,
    allowNull: false, 
    references: {
      model: Category,
      key: 'id',
    },
  },
  parent_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("active", "draft", "archived"),
    defaultValue: "draft",
  },
  status: {
  type: DataTypes.ENUM("active", "draft", "archived"),
  defaultValue: "draft",
  },
  is_domain: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_topic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  session_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,  // Automatically set the current timestamp
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,  // Automatically set the current timestamp on updates
  },
  
  
  
}, {
  schema: 'catalog',
  tableName: 'education',  // Table name for college
});

export { Education };

