/**
 * TOTLE Dev Script: Qualify User in All Topics
 * -----------------------------------------------------
 * Usage:
 *   node scripts/qualifyAllTopicsForUser.js <USER_ID>
 *
 * Example:
 *   node scripts/qualifyAllTopicsForUser.js 123e4567-e89b-12d3-a456-426614174000
 *
 * This will:
 *  - Fetch all topics from catalogue_nodes where is_topic = true
 *  - Create/Upsert entries in user.teachertopicstats
 *  - Update catalogue_nodes.qualified_teacher_ids / names arrays
 *  - Ensure the user becomes “Bridger” for every topic
 */

import dotenv from "dotenv";
dotenv.config();
import { sequelize1 } from "../src/config/sequelize.js";
import { CatalogueNode } from "../src/Models/CatalogModels/catalogueNode.model.js";
import { Teachertopicstats } from "../src/Models/TeachertopicstatsModel.js";
import { User } from "../src/Models/UserModels/UserModel.js";

async function qualifyAllTopicsForUser(userId) {
  try {
    await sequelize1.authenticate();
    console.log("✅ Connected to database");

    const user = await User.findByPk(userId, { attributes: ["id", "firstName"] });
    if (!user) {
      console.error("❌ User not found");
      process.exit(1);
    }

    const topics = await CatalogueNode.findAll({
      where: { is_topic: true },
      attributes: ["node_id", "name", "qualified_teacher_ids", "qualified_teacher_names"],
    });

    console.log(`📚 Found ${topics.length} topics. Starting qualification...`);

    let successCount = 0;
    for (const topic of topics) {
      const { node_id, name, qualified_teacher_ids = [], qualified_teacher_names = [] } = topic;

      // ✅ Add entry in Teachertopicstats if not exists
      const exists = await Teachertopicstats.findOne({
        where: { teacherId: userId, node_id },
      });

      if (!exists) {
        await Teachertopicstats.create({
          teacherId: userId,
          node_id,
          tier: "free",
          level: "Bridger",
          sessionCount: 0,
          rating: 0,
        });
      }

      // ✅ Update qualified_teacher_ids / names arrays in CatalogueNode
      const updatedIds = Array.isArray(qualified_teacher_ids)
        ? [...new Set([...qualified_teacher_ids, userId])]
        : [userId];
      const updatedNames = Array.isArray(qualified_teacher_names)
        ? [...new Set([...qualified_teacher_names, user.firstName])]
        : [user.firstName];

      await topic.update({
        qualified_teacher_ids: updatedIds,
        qualified_teacher_names: updatedNames,
      });

      successCount++;
      console.log(`✅ Qualified: ${name}`);
    }

    console.log(`\n🎉 Completed! User ${user.firstName} is now qualified in ${successCount} topics.`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize1.close();
    console.log("🔒 DB connection closed.");
  }
}

// ---- CLI entrypoint ----
const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/qualifyAllTopicsForUser.js <USER_ID>");
  process.exit(1);
}

qualifyAllTopicsForUser(userId);
