// grade.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { Board } from './BoardModel.js';
const Grade = sequelize1.define('Grade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the grade (e.g., "1st Grade", "10th Grade")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the grade
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Board,
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
  is_domain: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
  tableName: 'grade',  // Table name for grade
});


export { Grade };
