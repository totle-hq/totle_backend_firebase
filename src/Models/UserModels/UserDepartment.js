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
  roleName: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  roleType: {
    type: DataTypes.ENUM('read', 'edit', 'manage'),
    defaultValue: 'read',
  },
  department_role_id:{
    type: DataTypes.UUID,
    allowNull: true,
  },
  email:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  password:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    allowNull: false,
    defaultValue: 'active',
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
}, {
  schema: 'admin',
  tableName: 'user_departments_roles',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['role', 'departmentId'], // ✅ Valid unique constraint
    },
  ],
});

export { UserDepartment };
