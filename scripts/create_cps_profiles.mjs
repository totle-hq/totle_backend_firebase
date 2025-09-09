// scripts/create_cps_profiles.mjs
import { sequelize1 } from "../src/config/sequelize.js";

console.log("✅ Connecting to PostgreSQL at localhost:5432...");
console.log("🚀 Script started (ESM)");

async function main() {
  try {
    console.log("➡️ Ensuring schema, table, and indexes for user.cps_profiles ...");

    // Ensure schema
    await sequelize1.query('CREATE SCHEMA IF NOT EXISTS "user";');
    console.log("✅ Schema ensured");

    // Base table (in case it doesn’t exist at all)
    await sequelize1.query(`
      CREATE TABLE IF NOT EXISTS "user"."cps_profiles" (
        user_id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Table ensured (base)");

    // 🔧 Ensure all expected columns exist
    const columns = [
      `"tests_seen" INTEGER NOT NULL DEFAULT 0`,
      `"last_test_id" UUID NULL`,

      `"pattern_recognition" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"abstraction_capacity" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"rule_inference" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"decision_tree_depth" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"problem_decomposition" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"strategy_shift" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"deductive_strength" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"inductive_strength" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"cognitive_rigidity" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"tactical_depth" DECIMAL(5,2) NOT NULL DEFAULT 0`,

      `"retention_curve" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"recall_fidelity" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"recognition_bias" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"interference_resistance" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"spaced_recall_effectiveness" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"memory_decay_rate" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"episodic_memory_flag" DECIMAL(5,2) NOT NULL DEFAULT 0`,

      `"mean_response_time" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"speed_accuracy_tradeoff" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"adaptive_fluency_index" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"cognitive_load_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"reaction_variability" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"decision_latency" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"fluency_recovery_rate" DECIMAL(5,2) NOT NULL DEFAULT 0`,

      `"active_engagement_ratio" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"tab_switch_frequency" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"question_skipping_rate" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"hover_depth_index" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"backtracking_frequency" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"attention_recovery_rate" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"focus_decay_over_time" DECIMAL(5,2) NOT NULL DEFAULT 0`,

      `"strategy_selection_score" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"self_correction_rate" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"hint_utilization_efficiency" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"planning_latency" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"reflective_comment_depth" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"retry_strategy_shift" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"time_reallocation_efficiency" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"goal_alignment_flag" DECIMAL(5,2) NOT NULL DEFAULT 0`,

      `"persistence_score" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"resilience_rebound" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"frustration_threshold" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"effort_variability" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"strategy_adaptability" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"grit_trajectory" DECIMAL(5,2) NOT NULL DEFAULT 0`,
      `"recovery_latency" DECIMAL(7,2) NOT NULL DEFAULT 0`,
      `"plateau_breaking_score" DECIMAL(5,2) NOT NULL DEFAULT 0`
    ];

    for (const col of columns) {
      await sequelize1.query(
        `ALTER TABLE "user"."cps_profiles" ADD COLUMN IF NOT EXISTS ${col};`
      );
    }
    console.log("🔧 Columns ensured");

    // Indexes
    await sequelize1.query(`
      CREATE INDEX IF NOT EXISTS "cps_profiles_updated_idx"
      ON "user"."cps_profiles"(updated_at);
    `);

    await sequelize1.query(`
      CREATE INDEX IF NOT EXISTS "cps_profiles_tests_seen_idx"
      ON "user"."cps_profiles"(tests_seen);
    `);

    console.log("✅ Indexes ensured");

    const [rows] = await sequelize1.query(
      `SELECT to_regclass('user.cps_profiles') AS exists;`
    );
    console.log("🔍 Verification result:", rows);

    if (!rows || !rows[0] || !rows[0].exists) {
      throw new Error('Table "user.cps_profiles" was not created.');
    }

    console.log("🎉 All done — Table user.cps_profiles is ready.");
  } catch (err) {
    console.error("❌ Failed to prepare cps_profiles:", err);
    process.exitCode = 1;
  } finally {
    await sequelize1.close();
    console.log("🔒 Connection closed");
  }
}

main();
