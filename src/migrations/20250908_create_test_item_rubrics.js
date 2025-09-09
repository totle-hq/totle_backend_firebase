"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ensure the schema exists (idempotent)
    await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS "user";');

    // Create table
    await queryInterface.createTable(
      { schema: "user", tableName: "test_item_rubrics" },
      {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          // no DB default; Sequelize supplies UUIDs from the model on insert
        },

        test_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: { schema: "user", tableName: "tests" },
            key: "test_id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
          comment: "FK → user.tests(test_id)",
        },

        block_key: {
          type: Sequelize.ENUM(
            "reasoning_strategy",
            "metacognition_selfreg",
            "memory_retrieval",
            "speed_fluency",
            "attention_focus",
            "resilience_adaptability",
            "teaching"
          ),
          allowNull: false,
          comment: "Which CPS pipeline produced this item",
        },

        local_qid: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: "Item id within its block (1..N)",
        },

  option_impacts: {
  type: Sequelize.JSONB,
  allowNull: false,
  defaultValue: {},
  comment: "Per-option CPS parameter impacts (A–D → deltas)",
},

        gates: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: "Gate conditions for pass/fail style checks",
        },

        item_weight: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 1.0,
          comment:
            "Optional overall weight for this item in block-level aggregation",
        },

        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }
    );

    // Indexes
    await queryInterface.addIndex(
      { schema: "user", tableName: "test_item_rubrics" },
      ["test_id"],
      { name: "test_item_rubrics_test_id_idx" }
    );

    await queryInterface.addIndex(
      { schema: "user", tableName: "test_item_rubrics" },
      ["test_id", "block_key", "local_qid"],
      { unique: true, name: "test_item_rubrics_unique_triplet" }
    );

    // GIN index on JSONB
    await queryInterface.addIndex(
      { schema: "user", tableName: "test_item_rubrics" },
      ["option_impacts"],
      { using: "gin", name: "test_item_rubrics_option_impacts_gin" }
    );
  },

  async down(queryInterface, Sequelize) {
    // Drop indexes
    await queryInterface.removeIndex(
      { schema: "user", tableName: "test_item_rubrics" },
      "test_item_rubrics_option_impacts_gin"
    );
    await queryInterface.removeIndex(
      { schema: "user", tableName: "test_item_rubrics" },
      "test_item_rubrics_unique_triplet"
    );
    await queryInterface.removeIndex(
      { schema: "user", tableName: "test_item_rubrics" },
      "test_item_rubrics_test_id_idx"
    );

    // Drop table
    await queryInterface.dropTable({
      schema: "user",
      tableName: "test_item_rubrics",
    });

    // Drop ENUM type created for block_key to keep schema clean
    // Name pattern: enum_<schema>_<table>_<column>
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_user_test_item_rubrics_block_key";'
    );
  },
};
