// src/Models/bookedSession.js

import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

export const BookedSession = sequelize1.define(
  'BookedSession',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    teacher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    learner_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    topic_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    schema: 'user',
    tableName: 'booked_sessions',
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);
