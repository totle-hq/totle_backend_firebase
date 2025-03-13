// subject.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
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
  gradeId: {
    type: DataTypes.INTEGER,
    references: {
      model: Grade,  // Reference to the Grade model
      key: 'id',
    },
    allowNull: false,  // The Subject must be linked to a Grade
  },
}, {
  schema: 'catalog',
  tableName: 'subject',  // Table name for subjects
});



export { Subject };
