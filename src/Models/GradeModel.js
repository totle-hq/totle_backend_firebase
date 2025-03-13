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
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the grade (e.g., "1st Grade", "10th Grade")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the grade
  },
  boardId: {
    type: DataTypes.INTEGER,
    references: {
      model: Board,  // Reference to the Board model
      key: 'id',
    },
    allowNull: false,  // The Grade must be linked to a Board
  },
}, {
  schema: 'catalog',
  tableName: 'grade',  // Table name for grade
});


export { Grade };
