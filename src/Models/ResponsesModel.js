// models/response.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const Responses = sequelize1.define('Response', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  surveyId: {
    type: DataTypes.UUID,
    references: {
      model: 'Surveys',
      key: 'id',
    },
  },
  answer: {
    type: DataTypes.STRING, // Store selected option, rating, or text response
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'private', // Responses are in the private schema
  tableName: 'responses', // Table name for responses
});

export {Responses};
