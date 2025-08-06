import { DataTypes } from 'sequelize';

import { Objective } from './objective.model.js';
import { sequelize1 } from '../../config/sequelize.js';

export const KeyResult = sequelize1.define('KeyResult', {
  keyResultId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  objectiveId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Objective,
      key: 'objectiveId',
    },
    onDelete: 'CASCADE',
  },
  keyResultCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'e.g., OBJ0001-KR01',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100,
    },
  },
    priority: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 1,
  comment: 'Lower number = higher priority',
},
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'key_results',
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      fields: ['objectiveId'],
    },
  ],
});

// Associations
Objective.hasMany(KeyResult, { foreignKey: 'objectiveId', as: 'keyResults' });
KeyResult.belongsTo(Objective, { foreignKey: 'objectiveId', as: 'objective' });

// Before create hook to generate keyResultCode
KeyResult.beforeCreate(async (keyResult) => {
  console.log("Generating KeyResult Code:");

  const objective = await Objective.findByPk(keyResult.objectiveId);
  if (!objective || !objective.objectiveCode) {
    throw new Error('Objective code not found');
  }

  const count = await KeyResult.count({ where: { objectiveId: keyResult.objectiveId } });
  const next = String(count + 1).padStart(2, '0');
  keyResult.keyResultCode = `${objective.objectiveCode.replace('-', '')}-KR${next}`;
});
