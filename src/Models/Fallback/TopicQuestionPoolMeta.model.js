import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const TopicQuestionPoolMeta = sequelize1.define(
  "TopicQuestionPoolMeta",
  {
    topic_uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
    },

    pool_status: {
      type: DataTypes.ENUM("empty", "seeding", "ready"),
      defaultValue: "empty",
      allowNull: false,
    },

    dimensions_seeded: {
      type: DataTypes.JSONB, // e.g., { application: true, analysis: false }
      allowNull: true,
    },

    last_seeded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    last_replenished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "topic_question_pool_meta",
    schema: "user",
    timestamps: true,
  }
);
