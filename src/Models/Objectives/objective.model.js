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
    unique: true,
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
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'objectives',
  timestamps: true,
});

// Generate next objectiveCode before creation
Objective.beforeCreate(async (objective) => {
  const latest = await Objective.findOne({
    order: [['createdAt', 'DESC']],
  });
  const count = latest?.objectiveCode?.match(/\d+/)?.[0] || '0';
  const next = String(Number(count) + 1).padStart(4, '0');
  objective.objectiveCode = `OBJ-${next}`;
});
