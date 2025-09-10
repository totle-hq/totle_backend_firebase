// models/Department.js
import { DataTypes, ENUM } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

const Department = sequelize1.define('departments', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Stable department code (e.g., TECH, OPS, HR)',
  },
  slug: {
    type: DataTypes.STRING,
    
  },
  codename: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  schema: 'admin',
  tableName: 'departments',
  timestamps: true,
});

export { Department };
