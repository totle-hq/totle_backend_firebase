// models/feature.model.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { Epic } from './epics.model.js';


export const Feature = sequelize1.define('Feature', {
  featureId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  epicId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Epic, key: 'epicId' },
    onDelete: 'CASCADE',
  },
  featureCode: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  featureName: {
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
  schema: 'admin',
  tableName: 'features',
  timestamps: true,
});

Epic.hasMany(Feature, { foreignKey: 'epicId' });
Feature.belongsTo(Epic, { foreignKey: 'epicId' });

Feature.beforeCreate(async (feature) => {
  const epic = await Epic.findByPk(feature.epicId);
  const count = await Feature.count({ where: { epicId: feature.epicId } });
  const next = String(count + 1).padStart(2, '0');
  feature.featureCode = `${epic.epicCode.replace('-', '')}-FT${next}`;
});