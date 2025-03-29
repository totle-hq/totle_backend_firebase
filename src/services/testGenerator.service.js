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
export const checkRetestEligibility = async (userId, topicId) => {
  try {
    const latestTest = await Test.findOne({
      where: {
        user_id: userId,
        topic_uuid: topicId,
        status: "evaluated",
      },
      order: [["updated_at", "DESC"]],
    });

    if (!latestTest) {
      return { canRetake: true, cooldownEndsAt: null };
    }

    const lastAttempt = new Date(latestTest.updated_at);
    const cooldownPeriod = 5 * 24 * 60 * 60 * 1000; // 5 days
    const cooldownEndsAt = new Date(lastAttempt.getTime() + cooldownPeriod);
    const now = new Date();

    const canRetake = now >= cooldownEndsAt;

    if (latestTest.result && latestTest.result.score >= 80) {
      latestTest.eligible_for_bridger = true;
      await latestTest.save();
    }

    return { canRetake, cooldownEndsAt };
  } catch (error) {
    console.error("❌ Error checking retest eligibility:", error);
    throw new Error("Internal error checking test eligibility.");
  }
};
