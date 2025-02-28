// models/question.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Sequelize instance

const Question = sequelize1.define('Question', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  options: {
    type: DataTypes.JSONB, // Store options as JSON for multiple choice questions
  },
  surveyId: {
    type: DataTypes.UUID,
    references: {
      model: 'surveys', // Reference to Survey table
      key: 'id',
    },
  },
}, {
  schema: 'public', // Questions are in the public schema
  tableName: 'questions',
});

export {Question};
