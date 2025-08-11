
import { DataTypes, UUIDV4 } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';

export const AbsentNodeStats = sequelize1.define('AbsentNodeStats', {
  statId: {
    type: DataTypes.UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
searchTerm: {
  type: DataTypes.STRING(255),
  allowNull: false,
  unique: false,
  comment: "The exact search term typed by the user"
}
,
  searchCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  firstSeen: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  lastSearched: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {

  tableName: 'absent_node_stats',
  timestamps: true
});


