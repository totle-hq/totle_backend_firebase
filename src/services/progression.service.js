// src/services/progression.service.js
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { ProgressionThresholds } from "../Models/progressionThresholds.model.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";

/**
 * Teacher Progression Evaluation Service
 * --------------------------------------
 * Controls when a teacher moves from 'free' to 'paid' tier
 * and how level (Bridger → Expert → Master → Legend) evolves.
 */
export const ProgressionService = {
  /**
   * Evaluate tier and level for a teacher-topic pair
   */
  async evaluateProgression(teacherId, topicId) {
    try {
      const stats = await Teachertopicstats.findOne({ where: { teacherId, node_id: topicId } });
      if (!stats) return;

      // 🔍 Find topic → domain
      const topic = await CatalogueNode.findByPk(topicId);
      if (!topic) return;

      // Traverse up to domain node (may be subject → domain)
      let domain = topic;
      while (domain && !domain.is_domain && domain.parent_id) {
        domain = await CatalogueNode.findByPk(domain.parent_id);
      }

      // 🔢 Determine rating threshold for domain
      let ratingThreshold = 4.0;
      if (domain?.metadata?.rating_threshold) {
        ratingThreshold = domain.metadata.rating_threshold;
      } else {
        // fallback: check progression thresholds table
        const threshold = await ProgressionThresholds.findOne({
          where: { domain_id: domain?.node_id },
        });
        if (threshold?.rating_threshold) ratingThreshold = threshold.rating_threshold;
      }

      // -------------------------------------------------
      // 🟩 TIER LOGIC
      // -------------------------------------------------
      const meetsRating = stats.rating >= ratingThreshold;
      const currentTier = stats.tier;

      if (meetsRating && currentTier !== "paid") {
        stats.tier = "paid";
        stats.paidAt = new Date();
        console.log(`✅ Upgraded ${teacherId} to paid tier for topic ${topicId}`);
      }

      if (!meetsRating && currentTier !== "free") {
        stats.tier = "free";
        console.log(`⚠️ Downgraded ${teacherId} to free tier for topic ${topicId}`);
      }

      // -------------------------------------------------
      // 🟦 LEVEL LOGIC
      // -------------------------------------------------
      const sessionCount = stats.sessionCount || 0;
      let newLevel = "Bridger";

      const expertSessions = domain?.metadata?.expert_session_threshold || 20;
      const masterSessions = domain?.metadata?.master_session_threshold || 100;
      const legendSessions = domain?.metadata?.legend_session_threshold || 1000;

      if (sessionCount >= legendSessions) newLevel = "Legend";
      else if (sessionCount >= masterSessions) newLevel = "Master";
      else if (sessionCount >= expertSessions) newLevel = "Expert";

      if (stats.level !== newLevel) {
        stats.level = newLevel;
        console.log(`🎯 Updated ${teacherId} level → ${newLevel} for topic ${topicId}`);
      }

      await stats.save();
    } catch (error) {
      console.error("❌ Error in evaluateProgression:", error);
    }
  },
};
