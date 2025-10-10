/**
 * @file seedLegacyCpsProfiles.js
 * ---------------------------------------------------------------------------
 * 🧠 Purpose:
 * Backfill CPS profiles (IQ + Domain) for existing users who do not yet have
 * CPS records, so they appear in analytics without affecting existing data.
 *
 * ⚙️ Behavior:
 * - Fetches all users from `user.User`
 * - Skips users that already have CPS rows
 * - For others:
 *    → Creates 1 IQ profile row
 *    → Creates 1 Domain row per actual domain in CatalogueNode
 * - Fills realistic CPS values (45–75 range)
 * - Uses transactions for safety
 *
 * 🧩 Run once manually:
 *    node src/utils/seedLegacyCpsProfiles.js
 * ---------------------------------------------------------------------------
 */

import { sequelize1 } from "../config/sequelize.js";
import { User } from "../Models/UserModels/UserModel.js";
import { CpsProfile } from "../Models/CpsProfile.model.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { CPS_KEYS } from "../services/cps/cpsKeys.js";

async function main() {
  console.log("🧩 [CPS Seeder] Starting legacy CPS seeding process...");

  const t = await sequelize1.transaction();
  try {
    /* ------------------------------------------------------------------ */
    /* Step 1: Get all active users                                       */
    /* ------------------------------------------------------------------ */
    const users = await User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      transaction: t,
    });

    if (!users.length) {
      console.log("⚠️ No users found in system. Exiting.");
      await t.rollback();
      return;
    }

    /* ------------------------------------------------------------------ */
    /* Step 2: Get all existing CPS users                                 */
    /* ------------------------------------------------------------------ */
    const existingCps = await CpsProfile.findAll({
      attributes: ["user_id"],
      group: ["user_id"],
      transaction: t,
    });
    const existingUserIds = new Set(existingCps.map((c) => c.user_id));

    /* ------------------------------------------------------------------ */
    /* Step 3: Get all valid Domain nodes                                 */
    /* ------------------------------------------------------------------ */
// Identify top-level catalogue nodes (domains) — no parent_id
const domains = await CatalogueNode.findAll({
  where: { parent_id: null },
  attributes: ["node_id", "name"],
  transaction: t,
});

    if (!domains.length) {
      console.log("⚠️ No domains found in catalogue. Skipping domain seeding.");
    } else {
      console.log(`📚 Found ${domains.length} domains to seed.`);
    }

    /* ------------------------------------------------------------------ */
    /* Step 4: Define helper to create midrange random CPS scores         */
    /* ------------------------------------------------------------------ */
    function generateCpsValues() {
      const vals = {};
      for (const key of CPS_KEYS) {
        // random value between 45–75 (centered around 60)
        const base = 60 + (Math.random() - 0.5) * 30;
        vals[key] = Math.round(Math.max(0, Math.min(100, base)));
      }
      return vals;
    }

    /* ------------------------------------------------------------------ */
    /* Step 5: Prepare batch inserts                                      */
    /* ------------------------------------------------------------------ */
    const inserts = [];
    let userCount = 0;

    for (const user of users) {
      if (existingUserIds.has(user.id)) continue; // Skip users with CPS data

      userCount++;
      const iqRow = {
        user_id: user.id,
        context_type: "IQ",
        context_ref_id: null,
        tests_seen: 1,
        last_test_id: null,
        ...generateCpsValues(),
      };
      inserts.push(iqRow);

      for (const domain of domains) {
        inserts.push({
          user_id: user.id,
          context_type: "DOMAIN",
          context_ref_id: domain.node_id,
          tests_seen: 1,
          last_test_id: null,
          ...generateCpsValues(),
        });
      }
    }

    /* ------------------------------------------------------------------ */
    /* Step 6: Bulk insert                                                */
    /* ------------------------------------------------------------------ */
    if (!inserts.length) {
      console.log("✅ All users already have CPS profiles. No inserts needed.");
      await t.rollback();
      return;
    }

    await CpsProfile.bulkCreate(inserts, {
      transaction: t,
      validate: false,
      ignoreDuplicates: true,
    });

    await t.commit();

    console.log(`🎯 CPS seeding complete.`);
    console.log(`👥 Users processed: ${userCount}`);
    console.log(`🧩 Rows inserted: ${inserts.length}`);
  } catch (err) {
    console.error("❌ [CPS Seeder] Failed:", err);
    await t.rollback();
  } finally {
    await sequelize1.close();
    console.log("🔚 Connection closed.");
  }
}

/* ------------------------------------------------------------------ */
/* Execute when run directly                                          */
/* ------------------------------------------------------------------ */
if (process.argv[1].includes("seedLegacyCpsProfiles.js")) {
  main();
}
