// icseBoard.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
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
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Education,
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
  tableName: 'board',  // Table name for ICSE board
});



export { Board };
