// File: src/utils/testCooldown.utils.js

import { Test } from "../Models/test.model.js";

/**
 * Checks if a user is eligible to retake a test for a given topic.
 * Applies a fixed cooldown window (from DB cooling_period or default).
 *
 * @param {string} userId
 * @param {string} topicId
 * @returns {Promise<{ eligible: boolean, waitTime?: object, waitTimeMinutes?: number, cooldown_end?: string | null }>}
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
    return { eligible: true, cooldown_end: null };
  }

  // Handle test result logic
  if (recentTest.result?.passed === true) {
    return { eligible: true, cooldown_end: null };
  }

  // ✅ Use DB-stored cooling_period (days → minutes)
  if (recentTest.cooling_period && recentTest.cooling_period > 0) {
    cooldownMinutes = recentTest.cooling_period * 24 * 60;
  } else {
    cooldownMinutes = 0;
  }

  const lastSubmitted = new Date(recentTest.submitted_at);
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const cooldownEnd = new Date(lastSubmitted.getTime() + cooldownMs);
  const now = new Date();

  const remainingMs = cooldownEnd - now;

  if (remainingMs <= 0) {
    return { eligible: true, cooldown_end: null };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    eligible: false,
    waitTime: { days, hours, minutes, seconds },
    waitTimeMinutes: Math.floor(remainingMs / (1000 * 60)),
    cooldown_end: cooldownEnd.toISOString(), // 👈 exact timestamp
  };
};
