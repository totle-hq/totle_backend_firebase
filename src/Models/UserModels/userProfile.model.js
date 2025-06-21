// File: src/Models/userProfile.model.js

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

/**
 * UserProfile Model
 * Stores dynamic learning metrics for each user.
 */
export const UserProfile = sequelize1.define(
  "UserProfile",
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      comment: "Primary user ID (foreign key to users)",
    },
    learning_metrics: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "JSON containing learner's evolving metrics (33 values)",
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: "Last updated timestamp",
    },
  },
  {
    tableName: "user_profiles",
    schema: "user",
    timestamps: false,
    comment: "Stores AI-adaptive learning metrics for users",
  }
);
