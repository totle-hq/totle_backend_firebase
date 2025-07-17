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
    type: DataTypes.ENUM(
      'tenjiku', 'manhattan', 'helix', 'sentinel',
      'echo', 'kyoto', 'vault', 'legion', 'haven'
    ),
    allowNull: false,
  },
  headId: {
    type: DataTypes.UUID,
    allowNull: true, // FK to Admin
  },
  status:{
    type: DataTypes.ENUM('active', 'disabled'),
    allowNull: false
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true, // This makes it a sub-department
    references: {
      model: 'departments',
      key: 'id',
    },
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, {
  schema: 'admin',
  tableName: 'departments',
});

export { Department };
