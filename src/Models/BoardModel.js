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
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Education,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the board, e.g., "ICSE"
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the board
  },
}, {
  schema: 'catalog',
  tableName: 'board',  // Table name for ICSE board
});



export { Board };
