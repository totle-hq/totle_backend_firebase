// UserSubjectProgressModel.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

const UserDomainProgress = sequelize1.define('UserDomainProgress', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },

  user_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  subject_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  subject_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  topic_ids: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  topic_names: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  topics_completed: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  hierarchy_path: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  motivation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  goal: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  createdAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },

  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'user',
  tableName: 'user_progress',
});


export default UserDomainProgress ;