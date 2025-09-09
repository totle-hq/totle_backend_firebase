// scripts/rename_cps_mapping.js
import { sequelize1 } from "../src/config/sequelize.js";

async function main() {
  try {
    console.log("🔄 Renaming column cps_mapping → option_impacts...");

    await sequelize1.query(`
      ALTER TABLE "user"."test_item_rubrics"
      RENAME COLUMN "cps_mapping" TO "option_impacts";
    `);

    console.log("✅ Column renamed successfully.");
  } catch (err) {
    console.error("❌ Failed to rename column:", err.message);
  } finally {
    await sequelize1.close();
  }
}

main();
