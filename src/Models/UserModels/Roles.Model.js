
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
},{
    schema: 'admin',
    tableName: 'roles',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
});
