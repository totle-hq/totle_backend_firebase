import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

/**
 * ProgressionThresholds Model
 * Stores domain-specific session thresholds for progression
 * Controlled later by Nucleus Admin Panel
 */
export const ProgressionThresholds = sequelize1.define(
  "ProgressionThresholds",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    domain_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Reference to the domain this threshold applies to",
    },
    expert_session_threshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
      comment: "Number of sessions required to become Expert",
    },
    legend_session_threshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
      comment: "Number of sessions required to become Legend",
    },
  },
  {
    schema: "user",
    tableName: "progression_thresholds",
    timestamps: true,
    underscored: true,
    comment: "Stores progression thresholds per domain",
  }
);
