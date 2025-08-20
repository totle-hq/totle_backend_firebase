import { sequelize1 } from "../config/sequelize.js";
import { DataTypes } from "sequelize";

export const Teachertopicstats = sequelize1.define('teacher_topic_stats', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
      field: 'teacher_id', 
  },
  node_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  tier: {
    type: DataTypes.ENUM('free', 'paid'),
    allowNull: false,
    defaultValue: 'free'
  },
 
  level: {
    type: DataTypes.ENUM('Bridger', 'Expert', 'Master', 'Legend'),
    allowNull: true,
    defaultValue:"Bridger"
  },
  sessionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  paidAt: {
  type: DataTypes.DATE, 
  allowNull: true,
},
 
}, {
  schema: "catalog",
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  underscored: true,
  tableName: 'teacher_topic_stats',
});


Teachertopicstats.beforeSync(async () => {
  await sequelize1.query(`
    UPDATE catalog.teacher_topic_stats
    SET tier = 'free'
    WHERE tier NOT IN ('free', 'paid');
  `);
});
Teachertopicstats.beforeCreate((instance) => {
  // If it's already 'paid' on creation, set paidAt immediately
  if (instance.tier === 'paid' && !instance.paidAt) {
    instance.paidAt = new Date();
  }
});

Teachertopicstats.beforeUpdate((instance) => {
  // Only set paidAt the first time we go from 'free' -> 'paid'
  if (instance.changed('tier')) {
    const wasPaid = instance.previous('tier') === 'paid';
    const nowPaid = instance.tier === 'paid';

    if (!wasPaid && nowPaid && !instance.paidAt) {
      instance.paidAt = new Date();
    }
  }
});
