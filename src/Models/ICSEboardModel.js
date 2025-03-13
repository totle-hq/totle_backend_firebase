// icseBoard.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { School } from './SchoolModel.js';

const ICSEBoard = sequelize1.define('ICSEBoard', {
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
  schoolId: {
    type: DataTypes.INTEGER,
    references: {
      model: School,  // Reference to the School model
      key: 'id',
    },
    allowNull: false,  // The ICSEBoard must be linked to a School
  },
}, {
  schema: 'catalog',
  tableName: 'icse_board',  // Table name for ICSE board
});



export { ICSEBoard };
