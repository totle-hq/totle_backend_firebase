import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { CatalogueNode } from './CatalogModels/catalogueNode.model.js'; 
import { User } from './UserModels/UserModel.js'; 
import { Session } from './SessionModel.js';
const Feedback = sequelize1.define('learner_session_feedback', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  learner_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  session_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  bridger_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  domain_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  subject_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  topic_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  domain_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subject_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  topic_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  topic_id: {
    type: DataTypes.UUID,
    allowNull: true, 
  },
  star_rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  helpfulness_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 5 },
  },
  clarity_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 5 },
  },
  pace_feedback: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  engagement_yn: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  confidence_gain_yn: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  text_feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  flagged_issue: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  flag_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'user',
  tableName: 'learner_session_feedback',
  timestamps: false,
});

// 🔁 ASSOCIATIONS

// Feedback belongs to the learner (User)
Feedback.belongsTo(User, {
  foreignKey: 'learner_id',
  as: 'learner',
});

// Feedback belongs to a topic node
Feedback.belongsTo(CatalogueNode, {
  foreignKey: 'topic_id',
  as: 'topicNode',
});
Feedback.belongsTo(Session, {
  foreignKey: "session_id",
  as: "session",
});
export default Feedback;
