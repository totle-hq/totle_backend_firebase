import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

export const SessionAttendance = sequelize1.define('SessionAttendance', {
  attendance_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  session_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'missed'),
    defaultValue: 'absent',
    allowNull: false,
  
  },

  createdAt: {  
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  joined_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  left_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  schema: 'user',
  tableName: 'session_attendance',
  timestamps: true,
});
