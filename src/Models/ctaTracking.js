
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; 

const CTATracking = sequelize1.define('CTATracking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  page: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cta_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'user',         
  tableName: 'cta_tracking',
  timestamps: false,    
});

export { CTATracking };
