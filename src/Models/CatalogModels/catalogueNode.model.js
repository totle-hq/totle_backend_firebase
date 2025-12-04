// // src/models/CatalogModels/catalogueNode.model.js

// import { DataTypes } from "sequelize";
// import { sequelize1 } from "../../config/sequelize.js";

// export const CatalogueNode = sequelize1.define(
//   "CatalogueNode",
//   {
//     node_id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//     },
//     parent_id: {
//       type: DataTypes.UUID,
//       allowNull: true,
//     },
//     name: {
//       type: DataTypes.STRING(255),
//       allowNull: false,
//     },
//     description: {
//       type: DataTypes.STRING(512),
//       allowNull: true,
//     },
//     node_level: {
//       type: DataTypes.STRING(64),
//       allowNull: true, // e.g., 'level_1', 'level_2' or 'root', 'branch', etc.
//     },
//     is_topic: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: false,
//     },
//     is_domain: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: false,
//     },
//     is_subject:{
//       type: DataTypes.BOOLEAN,
//       defaultValue: false,
//     },
//     status: {
//       type: DataTypes.ENUM("active", "draft", "archived"),
//       defaultValue: "draft",
//     },
//     session_count: {
//       type: DataTypes.INTEGER,
//       defaultValue: 1,
//     },
//     prices: {
//       type: DataTypes.JSONB,
//       defaultValue: {},
//     },
//     metadata: {
//       type: DataTypes.JSONB,
//       defaultValue: {},
//     },
//     address_of_node:{
//       type: DataTypes.STRING(1024),
//       allowNull: true, // e.g., 'root/branch/level_1'
//     }
//   },
//   {
//     schema: "catalog",
//     tableName: "catalogue_nodes",
//     timestamps: true,
//     underscored: true,
//     indexes: [
//       { fields: ["parent_id"] },
//       { fields: ["node_level"] },
//     ],
//   }
// );

// // Self-referencing parent-child
// CatalogueNode.belongsTo(CatalogueNode, {
//   foreignKey: 'parent_id',     // My parent’s id
//   targetKey: 'node_id',        // The actual node it points to
//   as: 'parent',                // So we can do: topic.parent.name
// });

// CatalogueNode.hasMany(CatalogueNode, {
//   foreignKey: 'parent_id',     // I am the parent of these children
//   sourceKey: 'node_id',
//   as: 'children',              // So we can do: subject.children
// });

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
      allowNull: true,
    },
    is_topic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_domain: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_subject: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM("active", "draft", "archived"),
      defaultValue: "draft",
    },
    qualified_teacher_ids: {
  type: DataTypes.ARRAY(DataTypes.UUID),
  allowNull: false,
  defaultValue: [],
},
qualified_teacher_names: {
  type: DataTypes.ARRAY(DataTypes.STRING),
  allowNull: false,
  defaultValue: [],
},


    /* ---------- Existing business fields ---------- */
    session_count: { type: DataTypes.INTEGER, defaultValue: 1 },
    prices: { type: DataTypes.JSONB, defaultValue: {} },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    address_of_node: { type: DataTypes.STRING(1024), allowNull: true },

    /* =========================================================
       CPS AWARE FIELDS
       ========================================================= */

    // ---- Domain-level typed JSONB (seed once; refine later) ----
    domain_cognitive_profile: {
      // { reasoning, memory, speed, attention, metacognition, resilience } ∈ [0,1]
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: "Six-dim vector in [0,1] describing domain cognitive demand",
    },
    modality_mix: {
      // { verbal, spatial, numerical, symbolic } ∈ [0,1], sum≈1
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    knowledge_type_mix: {
      // { conceptual, procedural, factual, metacognitive } ∈ [0,1], sum≈1
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    domain_observed_pull_vector: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },

    // ---- Topic typed columns (your 7 + archetype) ----
    complexity_level: { type: DataTypes.INTEGER, allowNull: true }, // 1..5
    engagement_factor: { type: DataTypes.INTEGER, allowNull: true }, // 1..5
    retention_importance: { type: DataTypes.INTEGER, allowNull: true }, // 1..5
    application_type: {
      type: DataTypes.ENUM("conceptual", "procedural", "applied", "meta"),
      allowNull: true,
    },
    cross_domain_relevance: { type: DataTypes.INTEGER, allowNull: true }, // 1..5
    typical_learning_curve: { type: DataTypes.INTEGER, allowNull: true }, // 1..5
    depth_requirement: { type: DataTypes.INTEGER, allowNull: true }, // 1..5

    archetype: {
      type: DataTypes.ENUM(
        "FormulaDrill",
        "ConceptBuild",
        "ProcedureExec",
        "ProofDerivation",
        "CaseAnalysis",
        "RecallHeavy",
        "Synthesis"
      ),
      allowNull: true,
    },

    // ---- Topic computed fields (persist on save) ----
    computed_cps_weights: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    recommended_item_mix: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    recommended_time_pressure: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: true,
    },
    topic_observed_pull_vector: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    last_telemetry_update: { type: DataTypes.DATE, allowNull: true },
    topic_price: {
      type: DataTypes.INTEGER,
      defaultValue: 99,
    },
    payment_mode: {
      type: DataTypes.STRING,
      defaultValue: "LIVE",
    },
  },
  {
    schema: "catalog",
    tableName: "catalogue_nodes",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["parent_id"] },
      { fields: ["node_level"] },
      // Helpful filters
      { fields: ["is_domain"] },
      { fields: ["is_topic"] },
      // Postgres GIN indexes for JSONB (Sequelize will pass 'USING gin')
      { using: "GIN", fields: ["computed_cps_weights"] },
      { using: "GIN", fields: ["metadata"] },
      { using: "GIN", fields: ["domain_cognitive_profile"] },
    ],
  }
);

// Self-referencing parent-child
CatalogueNode.belongsTo(CatalogueNode, { foreignKey: "parent_id", targetKey: "node_id", as: "parent" });
CatalogueNode.hasMany(CatalogueNode, { foreignKey: "parent_id", sourceKey: "node_id", as: "children" });
