// models/RoleAssignmentLog.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

const RoleAssignmentLog = sequelize1.define('role_assignment_logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
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
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  assignedBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  actionType: {
    type: DataTypes.ENUM('assigned', 'revoked', 'modified'),
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'admin',
  timestamps: false,
});

export { RoleAssignmentLog };
