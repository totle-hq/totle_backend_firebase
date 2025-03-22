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
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Grade,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the subject (e.g., "Mathematics", "Physics")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the subject
  },
}, {
  schema: 'catalog',
  tableName: 'subject',  // Table name for subjects
});



export { Subject };
