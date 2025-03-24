// src/models/catalogueNode.model.js

import { DataTypes } from "sequelize";
import sequelizeCatalog from "../config/sequelizeCatalog.js";

/**
 * CatalogueNode Model
 * Represents a node in the hierarchical catalogue (domain, subject, topic)
 */
export const CatalogueNode = sequelizeCatalog.define(
    "CatalogueNode",
  {
    node_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: "Unique identifier for the node",
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Parent node reference (null if top-level)",
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Node name",
    },
    description: {
      type: DataTypes.STRING(512),
      allowNull: false,
      comment: "One-liner description",
    },
    is_domain: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Is this a domain node?",
    },
    is_topic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Is this a topic node?",
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
      comment: "Prices across skill levels",
    },
    session_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Number of sessions typically for this node",
    },
    average_session_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Calculated average based on usage",
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "archived"),
      allowNull: false,
      defaultValue: "draft",
      comment: "Current publishing status",
    },
    topic_params: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Optional topic metadata (only for is_topic)",
    },
    prerequisites: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: "Array of prerequisite objects (type + value)",
    },
  },
  {
    tableName: "catalogue_nodes",
    timestamps: true, // adds createdAt and updatedAt
    underscored: true,
    paranoid: false,
    indexes: [{ fields: ["parent_id"] }],
    comment: "Catalogue node table representing hierarchical structure",
  }
);
