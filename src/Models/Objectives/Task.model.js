// models/task.model.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { Feature } from './Feature.model.js';


export const Task = sequelize1.define('Task', {
  taskId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  featureId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Feature, key: 'featureId' },
    onDelete: 'CASCADE',
  },
  taskCode: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  taskName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
    priority: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 1,
  comment: 'Lower number = higher priority',
},
   status: {
  type: DataTypes.STRING,
  allowNull: false,
  defaultValue: 'to-do',
  validate: {
    isIn: [['to-do', 'inProgress', 'done', 'review']],
  },
}

}, {
  tableName: 'tasks',
  timestamps: true,
});

Feature.hasMany(Task, { foreignKey: 'featureId' });
Task.belongsTo(Feature, { foreignKey: 'featureId' });

Task.beforeCreate(async (task) => {
  const feature = await Feature.findByPk(task.featureId);
  const count = await Task.count({ where: { featureId: task.featureId } });
  const next = String(count + 1).padStart(2, '0');
  task.taskCode = `${feature.featureCode.replace('-', '')}-TK${next}`;
});
