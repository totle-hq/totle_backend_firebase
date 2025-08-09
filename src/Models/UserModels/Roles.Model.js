
import { sequelize1 } from '../../config/sequelize.js';

import { DataTypes } from 'sequelize';

const Role = sequelize1.define('roles', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  departmentName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  departmentId:{
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'departments',
      key: 'id',
    },
  },
},{
    schema: 'admin',
    tableName: 'roles',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
});

export { Role };