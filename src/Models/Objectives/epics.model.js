// models/epic.model.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { KeyResult } from './keyresult.model.js';

export const Epic = sequelize1.define('Epic', {
  epicId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  keyResultId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: KeyResult, key: 'keyResultId' },
    onDelete: 'CASCADE',
  },
  epicCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  epicName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
    priority: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 1,
  comment: 'Lower number = higher priority',
},
  status:{
    type:DataTypes.STRING,
    allowNull:false
  }
}, {
  tableName: 'epics',
  timestamps: true,
});

KeyResult.hasMany(Epic, { foreignKey: 'keyResultId' });
Epic.belongsTo(KeyResult, { foreignKey: 'keyResultId' });

Epic.beforeCreate(async (epic) => {
  console.log("Creating epic for keyResultId:", epic.keyResultId);

  if (!epic.keyResultId) {
    throw new Error("Missing keyResultId for epic.");
  }

  const kr = await KeyResult.findByPk(epic.keyResultId);
  if (!kr) {
    console.error("❌ No KeyResult found for ID:", epic.keyResultId);
    throw new Error(`No KeyResult found for id: ${epic.keyResultId}`);
  }

  if (!kr.keyResultCode) {
    console.error("❌ KeyResult has no keyResultCode:", kr);
    throw new Error("keyResultCode is required to generate epicCode.");
  }

  const count = await Epic.count({ where: { keyResultId: epic.keyResultId } });
  const next = String(count + 1).padStart(2, '0');
  epic.epicCode = `${kr.keyResultCode.replace('-', '')}-EP${next}`;
  console.log("✅ Generated epicCode:", epic.epicCode);
});

