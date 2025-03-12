// grade.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { School } from './school.js';  // Import the School model

const Grade = sequelize1.define('Grade', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the grade (e.g., "1st Grade", "10th Grade")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the grade
  },
  schoolId: {
    type: DataTypes.INTEGER,
    references: {
      model: School,  // Reference to the School model
      key: 'id',
    },
    allowNull: false,  // The Grade must be linked to a School
  },
}, {
  schema: 'catalog',
  tableName: 'grade',  // Table name for grade
});


export { Grade };
