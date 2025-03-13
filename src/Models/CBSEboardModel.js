// cbseBoard.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { School } from './SchoolModel.js';

const CBSEBoard = sequelize1.define('CBSEBoard', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the board, e.g., "CBSE"
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the board
  },
  schoolId: {
    type: DataTypes.INTEGER,
    references: {
      model: School,  // Reference to the School model
      key: 'id',
    },
    allowNull: false,  // The CBSEBoard must be linked to a School
  },
}, {
  schema: 'catalog',
  tableName: 'cbse_board',  // Table name for CBSE board
});


export { CBSEBoard };
