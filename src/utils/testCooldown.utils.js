// File: src/utils/testCooldown.utils.js

import { Test } from "../Models/test.model.js";

/**
 * Checks if a user is eligible to retake a test for a given topic.
 * Applies a fixed cooldown window (e.g., 24 hours) between tests.
 *
 * @param {string} userId
 * @param {string} topicId
 * @returns {Promise<{ eligible: boolean, waitTimeInMinutes?: number }>}
 */
export const isUserEligibleForRetest = async (userId, topicId) => {
  // Define cooldown period in minutes (e.g., 24 hours = 1440 minutes)
  // const cooldownMinutes = 1440;

  // Find the most recent submitted or evaluated test for this user-topic
  const recentTest = await Test.findOne({
    where: {
      user_id: userId,
      topic_uuid: topicId,
      status: ["submitted", "evaluated"],
    },
    order: [["submitted_at", "DESC"]],
  });

  if (!recentTest || !recentTest.submitted_at) {
    return { eligible: true }; // No past test = eligible
  }

  const now = new Date();
  const lastSubmitted = new Date(recentTest.submitted_at);

  const cooldownDays = recentTest.cooling_period || 1;
  const cooldownMinutes = cooldownDays * 24 * 60;

  const diffMs = now - lastSubmitted;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes >= cooldownMinutes) {
    return { eligible: true };
  }

  const waitTimeInMinutes = cooldownMinutes - diffMinutes;
  return {
    eligible: false,
    waitTimeInMinutes,
  };
};
