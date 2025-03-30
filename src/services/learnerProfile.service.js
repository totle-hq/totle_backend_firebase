// File: src/services/learnerProfile.service.js

import { UserProfile } from "../Models/userProfile.model.js";

/**
 * Retrieves the 33 learning metrics for a specific user.
 * @param {string} userId - UUID of the user.
 * @returns {Promise<object>} - Learning metrics JSON.
 */
export async function getUserLearningMetrics(userId) {
  try {
    const profile = await UserProfile.findOne({ where: { user_id: userId } });

    if (!profile) {
      throw new Error(`No user profile found for user_id: ${userId}`);
    }

    return profile.learning_metrics;
  } catch (error) {
    console.error("❌ Error in getUserLearningMetrics:", error);
    throw error;
  }
}
