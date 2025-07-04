// models/UserDepartment.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

const UserDepartment = sequelize1.define('user_departments', {
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  roleType: {
    type: DataTypes.ENUM('read', 'edit', 'manage'),
    defaultValue: 'read',
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING), // e.g., ['moderator', 'test_gatekeeper']
    defaultValue: [],
  },
}, {
  schema: 'admin',
  tableName: 'user_departments',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'departmentId'],
    },
  ],
});

export { UserDepartment };
