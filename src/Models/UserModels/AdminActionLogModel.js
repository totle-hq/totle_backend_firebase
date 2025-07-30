// models/admin-action-log.model.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

const AdminActionLog = sequelize1.define('admin_action_logs', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  performedBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  actionType: {
    type: DataTypes.STRING, // e.g., 'assign_role', 'approve_test', 'edit_policy'
    allowNull: false,
  },
  objectType: {
    type: DataTypes.STRING, // e.g., 'user', 'test', 'policy', 'flag'
    allowNull: false,
  },
  objectId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  schema: 'admin',
  tableName: 'admin_action_logs',
  timestamps: false,
});

export { AdminActionLog };
