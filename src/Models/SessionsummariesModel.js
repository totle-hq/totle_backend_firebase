// src/Models/SessionsummariesModel.js

import { sequelize1 } from "../config/sequelize.js";
import { DataTypes } from "sequelize";

export const SessionSummaires=sequelize1.define('session_summaries ',{
        id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true, 
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    summaryText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING), // or STRING if using comma-separated
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
},{
  schema: 'admin',
  tableName: 'session_summaries',
  timestamps: true,
  
})