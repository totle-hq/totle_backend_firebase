import { DataTypes } from 'sequelize';
import { Objective } from './objective.model.js';
import { sequelize1 } from '../../config/sequelize.js';

// ❗ We intentionally avoid ENUM for targetOperator while using sync({ alter: true })
// to prevent the Postgres "USING" syntax error. We validate in app code instead.

export const KeyResult = sequelize1.define(
  'KeyResult',
  {
    keyResultId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    objectiveId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Objective, key: 'objectiveId' },
      onDelete: 'CASCADE',
    },

    keyResultCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'e.g., OBJ0001-KR01',
      // unique: true, // ❌ remove inline unique to avoid invalid ALTER
    },

    // Basics
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 100 },
    },

    // Target & Measurement
    targetMetric: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Human label for metric (e.g., 7d activation)',
    },

    // ⚠️ STRING instead of ENUM to avoid sync alter errors.
    targetOperator: {
      type: DataTypes.STRING(3), // 'gte','lte','eq','gt','lt'
      allowNull: true,
      comment: 'Comparison operator for progress calculation',
      validate: {
        isIn: [['gte', 'lte', 'eq', 'gt', 'lt']],
      },
    },

    targetValue: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(24),
      allowNull: true,
    },
    currentValue: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    measureSource: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'e.g., dashboard name, SQL, analytics view',
    },

    // Status
    status: {
      type: DataTypes.STRING(16), // could be ENUM later via migration
      allowNull: true,
      validate: {
        isIn: [['on_track', 'at_risk', 'off_track', 'paused', 'done']],
      },
      defaultValue: 'on_track',
    },

    // Ownership
    ownerDepartmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to admin.departments.id',
    },
    ownerUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to users table (if present)',
    },

    // Schedule
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // Ordering
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Lower number = higher priority (1 is top)',
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    schema: 'admin',
    tableName: 'key_results',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['objectiveId'] },
      { unique: true, fields: ['keyResultCode'] }, // ✅ uniqueness via index (safe with alter)
      { fields: ['ownerDepartmentId'] },
      { fields: ['ownerUserId'] },
      { fields: ['status'] },
    ],
  }
);

// Associations
Objective.hasMany(KeyResult, { foreignKey: 'objectiveId', as: 'keyResults' });
KeyResult.belongsTo(Objective, { foreignKey: 'objectiveId', as: 'objective' });

// Before create hook to generate keyResultCode
KeyResult.beforeCreate(async (keyResult) => {
  const objective = await Objective.findByPk(keyResult.objectiveId);
  if (!objective || !objective.objectiveCode) {
    throw new Error('Objective code not found');
  }
  const count = await KeyResult.count({ where: { objectiveId: keyResult.objectiveId } });
  const next = String(count + 1).padStart(2, '0');
  keyResult.keyResultCode = `${objective.objectiveCode.replace('-', '')}-KR${next}`;
});
