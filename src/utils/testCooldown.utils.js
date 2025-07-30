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
 
  let cooldownMinutes = 0;
 
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
 
  // Handle test result logic
 
  const percentage = recentTest.result?.percentage;
 
  const passed = recentTest.result?.passed;
 
  if (passed === true) {
 
    return { eligible: true };
 
  }
 
  // Set cooldown based on result
 
  if (percentage >= 80 && passed === false) {
 
    cooldownMinutes = 1440; // 24 hours
 
  } else if (percentage < 80 && passed === false) {
 
    cooldownMinutes = 10080; // 7 days
 
  }
 
  const now = new Date();
 
  const lastSubmitted = new Date(recentTest.submitted_at);
 
  // If cooling_period is set in DB, use that (overrides previous logic)
 
  // if (recentTest.cooling_period) {
 
  //   cooldownMinutes = recentTest.cooling_period * 24 * 60;
 
  // }
 
  const diffMs = now - lastSubmitted;
 
  const cooldownMs = cooldownMinutes * 60 * 1000;
 
  const remainingMs = cooldownMs - diffMs;
 
 
  if (remainingMs <= 0) {
 
    return { eligible: true };
 
  }
 
  const totalSeconds = Math.floor(remainingMs / 1000);
 
  const days = Math.floor(totalSeconds / (24 * 3600));
 
 
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
 
 
  const minutes = Math.floor((totalSeconds % 3600) / 60);
 
  const seconds = totalSeconds % 60;
 
  return {
 
    eligible: false,
 
    waitTime: {
 
      days,
 
      hours,
 
      minutes,
 
      seconds,
 
    },
 
    waitTimeMinutes: Math.floor(remainingMs / (1000 * 60)),
 
  };
 
};
 
 

