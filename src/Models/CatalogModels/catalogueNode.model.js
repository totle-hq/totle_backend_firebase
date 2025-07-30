// src/models/CatalogModels/catalogueNode.model.js

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const CatalogueNode = sequelize1.define(
  "CatalogueNode",
  {
    node_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
      allowNull: true,
    },
    node_level: {
      type: DataTypes.STRING(64),
      allowNull: true, // e.g., 'level_1', 'level_2' or 'root', 'branch', etc.
    },
    is_topic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_domain: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_subject:{
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM("active", "draft", "archived"),
      defaultValue: "draft",
    },
    session_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    prices: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    address_of_node:{
      type: DataTypes.STRING(1024),
      allowNull: true, // e.g., 'root/branch/level_1'
    }
  },
  {
    schema: "catalog",
    tableName: "catalogue_nodes",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["parent_id"] },
      { fields: ["node_level"] },
    ],
  }
);

// Self-referencing parent-child
CatalogueNode.belongsTo(CatalogueNode, {
  foreignKey: 'parent_id',     // My parent’s id
  targetKey: 'node_id',        // The actual node it points to
  as: 'parent',                // So we can do: topic.parent.name
});

CatalogueNode.hasMany(CatalogueNode, {
  foreignKey: 'parent_id',     // I am the parent of these children
  sourceKey: 'node_id',
  as: 'children',              // So we can do: subject.children
});
