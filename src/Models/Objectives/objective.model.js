import { DataTypes, UUIDV4 } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

export const Objective = sequelize1.define('Objective', {
  objectiveId: {
    type: DataTypes.UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  objectiveCode: {
    type: DataTypes.STRING(12),
    allowNull: false,
    comment: 'e.g., OBJ-0001, OBJ-0043 etc.',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Represents Level 1, Level 2, etc.',
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'User ID of the creator',
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'objectives',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['objectiveCode'],
    },
  ],
});
