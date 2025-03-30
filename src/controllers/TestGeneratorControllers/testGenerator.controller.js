// File: src/controllers/testGenerator.controller.js

import { CatalogueNode } from "../../Models/catalogueNode.model.js";
import { getUserLearningMetrics } from "../../services/learnerProfile.service.js";
import { evaluateDifficulty } from "../../utils/testDifficulty.utils.js";
import { generateQuestions } from "../../services/questionGenerator.service.js";
import { isUserEligibleForRetest } from "../../utils/testCooldown.utils.js";
import { saveTest } from "../../services/testStorage.service.js";

/**
 * POST /api/tests/generate
 * Request Body: { userId: string, topicId: string }
 */
export const generateTest = async (req, res) => {
  try {
    const { userId, topicId } = req.body;

    // Input validation
    if (!userId || !topicId) {
      return res.status(400).json({ success: false, message: "Missing userId or topicId." });
    }

    // 1. Fetch topic from catalogue
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ success: false, message: "Invalid topic." });
    }

    // 2. Get user metrics
    const learnerProfile = await getUserLearningMetrics(userId);

    // 3. Evaluate appropriate difficulty
    const difficulty = evaluateDifficulty(topic.topic_params, learnerProfile);

    // 4. Generate questions
    const questions = await generateQuestions(topicId, difficulty, learnerProfile);

    // 5. (Optional) Save test to DB or cache
// 5. Save test to database
const savedTest = await Test.create({
    user_id: userId,
    topic_id: topicId,
    difficulty,
    status: "generated",
    questions, // JSON array
    created_at: new Date(),
    updated_at: new Date(),
  });
  
  return res.status(200).json({
    success: true,
    message: "Test generated successfully.",
    data: {
      test_id: savedTest.test_id,
      topicId,
      difficulty,
      questions,
    },
  });
  
  } catch (error) {
    console.error("❌ Error generating test:", error);
    return res.status(500).json({ success: false, message: "Failed to generate test.", error: error.message });
  }
};

// ✅ Start a Test
export const startTest = async (req, res) => {
  try {
    const { test_id } = req.params;

    const test = await Test.findByPk(test_id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    if (test.status !== "generated") {
      return res.status(400).json({ success: false, message: "Test cannot be started in its current state" });
    }

    test.status = "started";
    test.started_at = new Date();
    await test.save();

    return res.status(200).json({ success: true, message: "Test started", data: test });
  } catch (error) {
    console.error("❌ Error starting test:", error);
    return res.status(500).json({ success: false, message: "Failed to start test", error: error.message });
  }
};

// ✅ Submit a test (status → "submitted")
export const submitTest = async (req, res) => {
  try {
    const { test_id } = req.params;

    // Check if the test exists
    const test = await Test.findByPk(test_id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    // Update status and timestamp
    test.status = "submitted";
    test.submitted_at = new Date();

    await test.save();

    return res.status(200).json({
      success: true,
      message: "Test submitted successfully",
      data: test,
    });
  } catch (error) {
    console.error("❌ Error submitting test:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit test",
      error: error.message,
    });
  }
};

/**
 * Evaluate a submitted test and assign scores per question
 * This function assumes the test has been submitted and contains learner responses.
 */
export const evaluateTest = async (req, res) => {
  const { test_id } = req.params;

  try {
    const test = await Test.findByPk(test_id);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });
    if (test.status !== "submitted") {
      return res.status(400).json({ success: false, message: "Only submitted tests can be evaluated" });
    }

    const questions = test.questions || [];
    const answers = test.answers || {};

    const scoredResults = questions.map((question) => {
      const learnerAnswer = answers[question.id];
      const isCorrect = learnerAnswer === question.correct_answer; // Assumes exact match
      return {
        question_id: question.id,
        score: isCorrect ? 1 : 0,
        correct: isCorrect,
        learnerAnswer,
        correctAnswer: question.correct_answer,
      };
    });

    const totalScore = scoredResults.reduce((sum, q) => sum + q.score, 0);

    test.evaluation_result = {
      total_score: totalScore,
      max_score: questions.length,
      details: scoredResults,
    };
    test.status = "evaluated";
    await test.save();

    return res.status(200).json({
      success: true,
      message: "Test evaluated",
      evaluation: test.evaluation_result,
    });
  } catch (error) {
    console.error("❌ Error evaluating test:", error);
    return res.status(500).json({ success: false, message: "Failed to evaluate test", error: error.message });
  }
};

/**
 * GET /api/tests/eligibility?userId=123&topicId=abc
 * Returns: { eligible: boolean, waitTimeMinutes: number }
 */
export const checkUserTestEligibility = async (req, res) => {
  try {
    const { userId, topicId } = req.query;

    if (!userId || !topicId) {
      return res.status(400).json({ success: false, message: "Missing userId or topicId" });
    }

    const { eligible, waitTimeMinutes } = await isUserEligibleForRetest(userId, topicId);

    return res.status(200).json({ success: true, data: { eligible, waitTimeMinutes } });
  } catch (error) {
    console.error("❌ Error checking retest eligibility:", error);
    return res.status(500).json({ success: false, message: "Failed to check eligibility", error: error.message });
  }
};

// ✅ Check if user is eligible to retake a test for a topic (based on cooldown)
export const checkRetestEligibility = async (req, res) => {
    try {
      const { userId, topicId } = req.query;
  
      if (!userId || !topicId) {
        return res.status(400).json({ success: false, message: "Missing userId or topicId" });
      }
  
      const eligible = await isUserEligibleForRetest(userId, topicId);
  
      return res.status(200).json({
        success: true,
        eligible,
        message: eligible
          ? "User is eligible to retake the test."
          : "User is currently on cooldown. Retest not allowed yet.",
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
  
  // ✅ Get all tests for a user (test history)
export const getUserTestHistory = async (req, res) => {
    try {
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(400).json({ success: false, message: "Missing userId." });
      }
  
      const tests = await Test.findAll({
        where: { user_id: userId },
        order: [["created_at", "DESC"]],
      });
  
      return res.status(200).json({
        success: true,
        data: tests,
      });
    } catch (error) {
      console.error("❌ Error fetching test history:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch test history.",
        error: error.message,
      });
    }
  };
  