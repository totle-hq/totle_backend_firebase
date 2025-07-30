import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { ProgressionThresholds } from "../Models/progressionThresholds.model.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { Sequelize } from "sequelize";

/**
 * Service to manage Bridger's Tier and Level based on rating & sessions
 */
export const ProgressionService = {
  /**
   * Evaluate and update a teacher's tier & level for a given topic
   * @param {UUID} teacherId
   * @param {UUID} topicId
   */
  async evaluateProgression(teacherId, topicId) {
    try {
      const stats = await Teachertopicstats.findOne({ where: { teacherId, node_id: topicId } });
      if (!stats) {
        console.log("❗ No stats found for this teacher-topic combo.");
        return;
      }

      // 1️⃣ Update Tier based on Rating
      if (stats.rating >= 4.0) {
        if (stats.tier === "Bridger") {
          stats.tier = "Paid";
          console.log(`✅ Upgraded ${teacherId} to Paid Tier for topic ${topicId}`);
        }
      } else {
        if (stats.tier !== "Bridger") {
          stats.tier = "Bridger";
          console.log(`⚠️ Downgraded ${teacherId} to Free Tier for topic ${topicId}`);
        }
      }

      // 2️⃣ Update Level based on Session Count & Thresholds
      const topic = await CatalogueNode.findByPk(topicId);
      if (!topic) return console.log("❗ Topic not found");

      const subjectId = topic.parent_id;
      if (!subjectId) return console.log("❗ No subject linked to this topic");

      const threshold = await ProgressionThresholds.findOne({ where: { domain_id: subjectId } });

      const expertThreshold = threshold?.expert_session_threshold || 20;
      const legendThreshold = threshold?.legend_session_threshold || 1000;

      let newLevel = stats.tier; // Default level remains same

      if (stats.sessionCount >= legendThreshold) {
        newLevel = "Legend";
      } else if (stats.sessionCount >= expertThreshold) {
        newLevel = "Expert";
      } else {
        newLevel = "Bridger";
      }

      if (stats.level !== newLevel) {
        stats.level = newLevel;
        console.log(`🎯 Updated ${teacherId} level to ${newLevel} for topic ${topicId}`);
      }

      await stats.save();
    } catch (error) {
      console.error("❌ Error in evaluateProgression:", error);
    }
  },
};
