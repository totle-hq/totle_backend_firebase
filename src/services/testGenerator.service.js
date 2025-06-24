// File: src/services/testGenerator.service.js

import { CatalogueNode } from "../Models/catalogueNode.model.js";
import { Question } from "../Models/QuestionModel.js";
import { evaluateDifficulty } from "../utils/testDifficulty.utils.js";
import { v4 as uuidv4 } from "uuid";
import { Test } from "../Models/test.model.js";

/**
 * Service responsible for generating adaptive tests per topic and user profile.
 */
export const TestGeneratorService = {
  /**
   * Generates a test for a specific topic and learner profile
   * @param {string} topicId
   * @param {object} learnerProfile
   * @returns {object} saved test record from DB
   */
  async generateTest(topicId, learnerProfile) {
    // Step 1: Validate topic existence and eligibility
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      throw new Error("Invalid or non-topic node specified.");
    }

    // Step 2: Determine AI difficulty level
    const difficultyLevel = evaluateDifficulty(topic.topic_params, learnerProfile);

    // Step 3: Fetch questions for topic and difficulty
    const questions = await Question.findAll({
      where: {
        topic_id: topicId,
        difficulty: difficultyLevel,
        status: "active",
      },
      limit: 10,
    });

    if (!questions || questions.length === 0) {
      throw new Error("No questions available for this topic and difficulty.");
    }

    // Step 4: Prepare question payload
    const formattedQuestions = questions.map(q => ({
      question_id: q.id,
      text: q.text,
      options: q.options,
      type: q.type,
    }));

    // Step 5: Construct test_settings
    const testSettings = {
      difficulty: difficultyLevel,
      retest_wait: 5, // days
      fraud_risk_score: 0, // Placeholder (to be evaluated later)
    };

    // Step 6: Save the test to the DB
    const savedTest = await Test.create({
      test_id: uuidv4(),
      user_id: learnerProfile.user_id,
      topic_uuid: topicId,
      topics: [{ topic_id: topicId, topic_title: topic.title }],
      questions: formattedQuestions,
      test_settings: testSettings,
      status: "generated",
    });

    return savedTest;
  },
};

/**
 * Checks if a user is allowed to take another test based on cooldown logic
 * and updates their Bridger eligibility accordingly.
 *
 * @param {string} userId - The ID of the user
 * @param {string} topicId - The ID of the topic being tested
 * @returns {Promise<{ canRetake: boolean, cooldownEndsAt: Date | null }>}
 */
export const checkRetestEligibility = async (req, res) => {
  try {
    const { userId, topicId } = req.query;

    if (!userId || !topicId) {
      return res.status(400).json({ success: false, message: "Missing userId or topicId" });
    }

    const latestTest = await Test.findOne({
      where: {
        user_id: userId,
        topic_uuid: topicId,
        status: "evaluated",
      },
      order: [["updated_at", "DESC"]],
    });

    if (!latestTest) {
      return res.status(200).json({
        success: true,
        eligible: true,
        message: "User has not taken a test yet.",
        cooldownEndsAt: null,
        cooling_period_days: null,
        remainingTimeMinutes: 0,
      });
    }

    const coolingDays = latestTest.cooling_period || 14;
    const cooldownMs = coolingDays * 24 * 60 * 60 * 1000;
    const lastAttempt = new Date(latestTest.updated_at);
    const cooldownEndsAt = new Date(lastAttempt.getTime() + cooldownMs);
    const now = new Date();

    const canRetake = now >= cooldownEndsAt;
    const remainingTimeMinutes = canRetake ? 0 : Math.round((cooldownEndsAt - now) / 60000);

    return res.status(200).json({
      success: true,
      eligible: canRetake,
      message: canRetake
        ? "User is eligible to retake the test."
        : "User is currently in cooling period.",
      cooldownEndsAt,
      cooling_period_days: coolingDays,
      remainingTimeMinutes,
    });
  } catch (error) {
    console.error("❌ Error checking test eligibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check eligibility",
      error: error.message,
    });
  }
};
