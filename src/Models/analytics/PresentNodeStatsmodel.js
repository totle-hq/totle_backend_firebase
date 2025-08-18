import { DataTypes, UUIDV4 } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

export const PresentNodeStats = sequelize1.define('PresentNodeStats', {
  statId: {
    type: DataTypes.UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  node_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'References catalogueNode.node_id',
  },
  searchCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  lastSearched: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {

  tableName: 'present_node_stats',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['node_id']
    }
  ]
});
