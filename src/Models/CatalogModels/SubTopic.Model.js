import { DataTypes } from "sequelize";
import { sequelize1 } from '../../config/sequelize.js';
import { Topic } from "./TopicModel.js";

export const Subtopic = sequelize1.define("Subtopic", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  parent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
        model: Topic,
        key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
    schema: "catalog",
    tableName: "subtopics",
    timestamps: true, // enables createdAt & updatedAt
    paranoid: true, // enables deletedAt for soft deletes
});
