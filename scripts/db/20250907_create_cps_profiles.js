// scripts/db/20250907_create_cps_profiles.js
// Purpose: Create "user"."cps_profiles" with 47 CPS parameters and backfill zeros for all existing users.
// Run: node scripts/db/20250907_create_cps_profiles.js

import { sequelize1 } from "../../config/sequelize.js";

async function up() {
  const transaction = await sequelize1.transaction();
  try {
    // 1) Create table if not exists
    await sequelize1.query(
      `
      CREATE TABLE IF NOT EXISTS "user"."cps_profiles" (
        user_id UUID PRIMARY KEY REFERENCES "user"."users"(id) ON DELETE CASCADE,

        -- Dimension 1 — Reasoning & Strategy
        pattern_recognition           NUMERIC(5,2) NOT NULL DEFAULT 0,
        abstraction_capacity          NUMERIC(5,2) NOT NULL DEFAULT 0,
        rule_inference                NUMERIC(5,2) NOT NULL DEFAULT 0,
        decision_tree_depth           NUMERIC(5,2) NOT NULL DEFAULT 0,
        problem_decomposition         NUMERIC(5,2) NOT NULL DEFAULT 0,
        strategy_shift                NUMERIC(5,2) NOT NULL DEFAULT 0,
        deductive_strength            NUMERIC(5,2) NOT NULL DEFAULT 0,
        inductive_strength            NUMERIC(5,2) NOT NULL DEFAULT 0,
        cognitive_rigidity            NUMERIC(5,2) NOT NULL DEFAULT 0,
        tactical_depth                NUMERIC(5,2) NOT NULL DEFAULT 0,

        -- Dimension 2 — Memory & Retrieval
        retention_curve               NUMERIC(5,2) NOT NULL DEFAULT 0,
        recall_fidelity               NUMERIC(5,2) NOT NULL DEFAULT 0,
        recognition_bias              NUMERIC(5,2) NOT NULL DEFAULT 0,
        interference_resistance       NUMERIC(5,2) NOT NULL DEFAULT 0,
        spaced_recall_effectiveness   NUMERIC(5,2) NOT NULL DEFAULT 0,
        memory_decay_rate             NUMERIC(5,2) NOT NULL DEFAULT 0,
        episodic_memory_flag          NUMERIC(5,2) NOT NULL DEFAULT 0,

        -- Dimension 3 — Processing Speed & Fluency
        mean_response_time            NUMERIC(7,2) NOT NULL DEFAULT 0, -- allow bigger numeric for time if needed
        speed_accuracy_tradeoff       NUMERIC(5,2) NOT NULL DEFAULT 0,
        adaptive_fluency_index        NUMERIC(5,2) NOT NULL DEFAULT 0,
        cognitive_load_tolerance      NUMERIC(5,2) NOT NULL DEFAULT 0,
        reaction_variability          NUMERIC(5,2) NOT NULL DEFAULT 0,
        decision_latency              NUMERIC(7,2) NOT NULL DEFAULT 0, -- latency can be longer
        fluency_recovery_rate         NUMERIC(5,2) NOT NULL DEFAULT 0,

        -- Dimension 4 — Attention & Cognitive Focus
        active_engagement_ratio       NUMERIC(5,2) NOT NULL DEFAULT 0,
        tab_switch_frequency          NUMERIC(7,2) NOT NULL DEFAULT 0,
        question_skipping_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
        hover_depth_index             NUMERIC(7,2) NOT NULL DEFAULT 0,
        backtracking_frequency        NUMERIC(7,2) NOT NULL DEFAULT 0,
        attention_recovery_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
        focus_decay_over_time         NUMERIC(5,2) NOT NULL DEFAULT 0,

        -- Dimension 5 — Metacognition & Self-Regulation
        strategy_selection_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
        self_correction_rate          NUMERIC(5,2) NOT NULL DEFAULT 0,
        hint_utilization_efficiency   NUMERIC(5,2) NOT NULL DEFAULT 0,
        planning_latency              NUMERIC(7,2) NOT NULL DEFAULT 0,
        reflective_comment_depth      NUMERIC(5,2) NOT NULL DEFAULT 0,
        retry_strategy_shift          NUMERIC(5,2) NOT NULL DEFAULT 0,
        time_reallocation_efficiency  NUMERIC(5,2) NOT NULL DEFAULT 0,
        goal_alignment_flag           NUMERIC(5,2) NOT NULL DEFAULT 0,

        -- Dimension 6 — Resilience & Adaptability
        persistence_score             NUMERIC(5,2) NOT NULL DEFAULT 0,
        resilience_rebound            NUMERIC(5,2) NOT NULL DEFAULT 0,
        frustration_threshold         NUMERIC(5,2) NOT NULL DEFAULT 0,
        effort_variability            NUMERIC(5,2) NOT NULL DEFAULT 0,
        strategy_adaptability         NUMERIC(5,2) NOT NULL DEFAULT 0,
        grit_trajectory               NUMERIC(5,2) NOT NULL DEFAULT 0,
        recovery_latency              NUMERIC(7,2) NOT NULL DEFAULT 0,
        plateau_breaking_score        NUMERIC(5,2) NOT NULL DEFAULT 0,

        -- Bookkeeping
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      `,
      { transaction }
    );

    // 2) Backfill: insert zeroed profiles for users who don't have one yet
    await sequelize1.query(
      `
      INSERT INTO "user"."cps_profiles" (
        user_id,

        pattern_recognition, abstraction_capacity, rule_inference, decision_tree_depth, problem_decomposition,
        strategy_shift, deductive_strength, inductive_strength, cognitive_rigidity, tactical_depth,

        retention_curve, recall_fidelity, recognition_bias, interference_resistance, spaced_recall_effectiveness,
        memory_decay_rate, episodic_memory_flag,

        mean_response_time, speed_accuracy_tradeoff, adaptive_fluency_index, cognitive_load_tolerance,
        reaction_variability, decision_latency, fluency_recovery_rate,

        active_engagement_ratio, tab_switch_frequency, question_skipping_rate, hover_depth_index,
        backtracking_frequency, attention_recovery_rate, focus_decay_over_time,

        strategy_selection_score, self_correction_rate, hint_utilization_efficiency, planning_latency,
        reflective_comment_depth, retry_strategy_shift, time_reallocation_efficiency, goal_alignment_flag,

        persistence_score, resilience_rebound, frustration_threshold, effort_variability, strategy_adaptability,
        grit_trajectory, recovery_latency, plateau_breaking_score,

        created_at, updated_at
      )
      SELECT
        u.id,

        0,0,0,0,0,
        0,0,0,0,0,

        0,0,0,0,0,
        0,0,

        0,0,0,0,
        0,0,0,

        0,0,0,0,
        0,0,0,

        0,0,0,0,
        0,0,0,0,

        0,0,0,0,0,
        0,0,0,

        NOW(), NOW()
      FROM "user"."users" u
      LEFT JOIN "user"."cps_profiles" p ON p.user_id = u.id
      WHERE p.user_id IS NULL;
      `,
      { transaction }
    );

    // 3) Helpful indexes for future analytics (quick filters / scans)
    await sequelize1.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE c.relname='idx_cps_profiles_updated_at' AND n.nspname='user') THEN
          CREATE INDEX idx_cps_profiles_updated_at ON "user"."cps_profiles"(updated_at DESC);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE c.relname='idx_cps_profiles_persistence' AND n.nspname='user') THEN
          CREATE INDEX idx_cps_profiles_persistence ON "user"."cps_profiles"(persistence_score DESC);
        END IF;
      END $$;
    `, { transaction });

    await transaction.commit();
    console.log("✅ cps_profiles table created and backfilled successfully.");
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Failed to create/backfill cps_profiles:", err);
    process.exit(1);
  } finally {
    await sequelize1.close();
  }
}

up();
