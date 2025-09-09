// inspect.js
import { sequelize1 } from "./src/config/sequelize.js";

async function main() {
  try {
    const [rows] = await sequelize1.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'user'
         AND table_name = 'test_item_rubrics';`
    );

    console.log("📋 Columns in user.test_item_rubrics:");
    console.table(rows);
  } catch (err) {
    console.error("❌ Error inspecting table:", err);
  } finally {
    await sequelize1.close();
  }
}

main();
