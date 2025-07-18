// models/UserDepartment.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

const UserDepartment = sequelize1.define('user_departments', {
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  headId: {
    type: DataTypes.UUID,
    allowNull: true, // Optional
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  role: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  roleType: {
    type: DataTypes.ENUM('read', 'edit', 'manage'),
    defaultValue: 'read',
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
}, {
  schema: 'admin',
  tableName: 'user_departments',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['role', 'departmentId'], // ✅ Valid unique constraint
    },
  ],
});

export { UserDepartment };
