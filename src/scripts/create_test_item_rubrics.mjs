// scripts/create_test_item_rubrics.mjs
import { sequelize1 } from "../src/config/sequelize.js";

console.log("🚀 Script started (ESM)");

async function main() {
  try {
    console.log("➡️ Ensuring schema, enum, table, and indexes for user.test_item_rubrics ...");

    await sequelize1.query('CREATE SCHEMA IF NOT EXISTS "user";');
    console.log("✅ Schema ensured");

    await sequelize1.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_user_test_item_rubrics_block_key'
        ) THEN
          CREATE TYPE "enum_user_test_item_rubrics_block_key" AS ENUM (
            'reasoning_strategy',
            'metacognition_selfreg',
            'memory_retrieval',
            'speed_fluency',
            'attention_focus',
            'resilience_adaptability',
            'teaching'
          );
        END IF;
      END$$;
    `);
    console.log("✅ Enum ensured");

    await sequelize1.query(`
      CREATE TABLE IF NOT EXISTS "user"."test_item_rubrics" (
        "id" UUID PRIMARY KEY,
        "test_id" UUID NOT NULL
          REFERENCES "user"."tests"("test_id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        "block_key" "enum_user_test_item_rubrics_block_key" NOT NULL,
        "local_qid" INTEGER NOT NULL CHECK ("local_qid" >= 1),
        "option_impacts" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "gates" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "item_weight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "test_item_rubrics_unique_triplet"
          UNIQUE ("test_id","block_key","local_qid")
      );
    `);
    console.log("✅ Table ensured");

    await sequelize1.query(`
      CREATE INDEX IF NOT EXISTS "test_item_rubrics_test_id_idx"
      ON "user"."test_item_rubrics"("test_id");
    `);

    await sequelize1.query(`
      CREATE INDEX IF NOT EXISTS "test_item_rubrics_option_impacts_gin"
      ON "user"."test_item_rubrics" USING GIN ("option_impacts");
    `);
    console.log("✅ Indexes ensured");

    const [rows] = await sequelize1.query(
      `SELECT to_regclass('user.test_item_rubrics') AS exists;`
    );
    console.log("🔍 Verification result:", rows);

    if (!rows || !rows[0] || !rows[0].exists) {
      throw new Error('Table "user.test_item_rubrics" was not created.');
    }

    console.log("🎉 All done — Table user.test_item_rubrics is ready.");
  } catch (err) {
    console.error("❌ Failed to prepare test_item_rubrics:", err);
    process.exitCode = 1;
  } finally {
    await sequelize1.close();
    console.log("🔒 Connection closed");
  }
}

main();
