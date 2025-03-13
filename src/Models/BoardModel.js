// icseBoard.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Education } from './EducationModel.js';

const Board = sequelize1.define('Board', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the board, e.g., "ICSE"
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the board
  },
  eduId: {
    type: DataTypes.INTEGER,
    references: {
      model: Education,  // Reference to the School model
      key: 'id',
    },
    allowNull: false,  // The Board must be linked to a School
  },
}, {
  schema: 'catalog',
  tableName: 'board',  // Table name for ICSE board
});



export { Board };
