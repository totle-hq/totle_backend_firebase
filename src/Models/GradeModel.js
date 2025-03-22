// grade.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Board } from './BoardModel.js';
const Grade = sequelize1.define('Grade', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Board,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the grade (e.g., "1st Grade", "10th Grade")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the grade
  },
}, {
  schema: 'catalog',
  tableName: 'grade',  // Table name for grade
});


export { Grade };
