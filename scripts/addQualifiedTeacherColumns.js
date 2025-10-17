/**
 * Quick Schema Patch Script
 * Adds `qualified_teacher_ids` and `qualified_teacher_names` columns
 * to catalog.catalogue_nodes safely (if missing).
 *
 * Usage:
 *   pnpm exec node scripts/addQualifiedTeacherColumns.js
 */

import dotenv from "dotenv";
dotenv.config();
import { sequelize1 } from "../src/config/sequelize.js";

async function addQualifiedTeacherColumns() {
  const schema = "catalog";
  const table = "catalogue_nodes";

  try {
    console.log("🔍 Checking if columns exist...");
    const [results] = await sequelize1.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${table}';
    `);

    const existing = results.map((r) => r.column_name);
    const missing = [];

    if (!existing.includes("qualified_teacher_ids")) {
      console.log("➕ Adding column: qualified_teacher_ids (UUID[])");
      await sequelize1.query(`
        ALTER TABLE "${schema}"."${table}"
        ADD COLUMN qualified_teacher_ids UUID[] DEFAULT '{}';
      `);
      missing.push("qualified_teacher_ids");
    }

    if (!existing.includes("qualified_teacher_names")) {
      console.log("➕ Adding column: qualified_teacher_names (TEXT[])");
      await sequelize1.query(`
        ALTER TABLE "${schema}"."${table}"
        ADD COLUMN qualified_teacher_names TEXT[] DEFAULT '{}';
      `);
      missing.push("qualified_teacher_names");
    }

    if (missing.length === 0) {
      console.log("✅ Both columns already exist — no changes made.");
    } else {
      console.log(`✅ Added columns: ${missing.join(", ")}`);
    }
  } catch (err) {
    console.error("❌ Error running schema patch:", err.message);
  } finally {
    await sequelize1.close();
    console.log("🔒 DB connection closed.");
  }
}

addQualifiedTeacherColumns();
