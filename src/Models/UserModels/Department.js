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
  parentId: {
    type: DataTypes.UUID,
    allowNull: true, // This makes it a sub-department
    references: {
      model: 'departments',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, {
  schema: 'admin',
  tableName: 'departments',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

export { Department };
