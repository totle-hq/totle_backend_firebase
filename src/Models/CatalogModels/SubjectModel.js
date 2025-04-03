// subject.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { Grade } from './GradeModel.js';

const Subject = sequelize1.define('Subject', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the subject (e.g., "Mathematics", "Physics")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the subject
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Grade,
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
    defaultValue: false,
  },
  is_topic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
  tableName: 'subject',  // Table name for subjects
});



export { Subject };
