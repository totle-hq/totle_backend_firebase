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
  const cooldownMinutes = 1440; // 24 hours

  const recentTest = await Test.findOne({
    where: {
      user_id: userId,
      topic_uuid: topicId,
      status: ["submitted", "evaluated"],
    },
    order: [["submitted_at", "DESC"]],
  });

  if (!recentTest || !recentTest.submitted_at) {
    return { eligible: true };
  }

  const now = new Date();
  const lastSubmitted = new Date(recentTest.submitted_at);
  const diffMs = now - lastSubmitted;

  const cooldownMs = cooldownMinutes * 60 * 1000;
  const remainingMs = cooldownMs - diffMs;

  if (remainingMs <= 0) {
    return { eligible: true };
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  return {
    eligible: false,
    waitTime: {
      hours,
      minutes,
      seconds,
    },
    waitTimeMinutes: Math.floor(remainingMs / (1000 * 60)), // optional raw minutes
  };
};

