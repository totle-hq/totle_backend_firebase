// models/userMetrics.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Sequelize instance
import User from './user'; // User model for relationship

const UserMetrics = sequelize1.define('UserMetrics', {
  userId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  concept_mastery: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  accuracy: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  skill_application: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  creativity_expression: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  application_of_knowledge: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Add other metrics fields as needed
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
}, {
  schema: 'private', // UserMetrics is in the private schema
  tableName: 'user_metrics',
});

// Define the relationship
UserMetrics.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(UserMetrics, { foreignKey: 'userId' });

export {UserMetrics};
