import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const TestItemRubric = sequelize1.define(
  "TestItemRubric",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: "Surrogate PK for convenience",
    },

    test_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK → user.tests.test_id",
      references: {
        model: { schema: "user", tableName: "tests" },
        key: "test_id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    block_key: {
      type: DataTypes.ENUM(
        "reasoning_strategy",
        "metacognition_selfreg",
        "memory_retrieval",
        "speed_fluency",
        "attention_focus",
        "resilience_adaptability",
        "teaching",
        "baseline" // ✅ baseline tests allowed
      ),
      allowNull: false,
      comment: "Which CPS pipeline (or baseline) produced this item",
    },

    global_qid: {
      type: DataTypes.INTEGER, // ✅ use INTEGER for ordering & consistency
      allowNull: false,
      comment: "Global question ID within the test (1..N, unique per test)",
      validate: { min: 1 },
    },

    option_impacts: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "Per-option CPS impacts (A–D → param deltas, numeric only)",
    },

    gates: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "Gate conditions for pass/fail style checks (e.g., teaching_floor)",
    },

    item_weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 1.0,
      comment: "Optional overall weight for this item in block-level aggregation",
    },
  },
  {
    schema: "user",
    tableName: "test_item_rubrics",
    timestamps: true,
    underscored: true,
    comment:
      "Item-level CPS rubrics for tests; backend-only, questions stay in Test.questions",
    indexes: [
      { fields: ["test_id"] },
      { unique: true, fields: ["test_id", "global_qid"] }, // ✅ unique within test
      { using: "GIN", fields: ["option_impacts"] },
    ],
  }
);
