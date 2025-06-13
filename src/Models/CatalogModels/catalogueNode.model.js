// src/models/catalogueNode.model.js

import { DataTypes } from "sequelize";
import {sequelize1} from "../../config/sequelize.js";

/**
 * CatalogueNode Model
 * Represents a node in the hierarchical catalogue (domain, subject, topic)
 */
export const CatalogueNode = sequelize1.define(
    "CatalogueNode",
  {
    node_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    is_domain: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_topic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    prices: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0,
      },
    },
    session_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    average_session_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "archived"),
      allowNull: false,
      defaultValue: "draft",
    //   comment: "Current publishing status",
    },
    topic_params: {
      type: DataTypes.JSONB,
      allowNull: true,
      // comment: "Optional topic metadata (only for is_topic)",
    },
    prerequisites: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      // comment: "Array of prerequisite objects (type + value)",
    },
  },
  {
    schema:"catalog",
    tableName: "catalogue_nodes",
    timestamps: true, // adds createdAt and updatedAt
    underscored: true,
    // paranoid: false,
    indexes: [{ fields: ["parent_id"] }],
    // comment: "Catalogue node table representing hierarchical structure",
  }
);
