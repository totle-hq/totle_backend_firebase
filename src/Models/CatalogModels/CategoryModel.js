import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

const Category = sequelize1.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  parent_id: {  // ✅ Unified Parent ID for hierarchy
    type: DataTypes.UUID,
    allowNull: true, // NULL for top-level categories
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the category (e.g., "JEE Mains & Advanced")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the category
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
  schema: 'catalog',   // Correctly specifying the schema
  tableName: 'category',  // Correctly specifying the table name
  timestamps: true,  // Enables Sequelize to automatically manage createdAt and updatedAt
});

export { Category };
