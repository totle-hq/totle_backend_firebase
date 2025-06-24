// File: src/controllers/testGenerator.controller.js

import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { getUserLearningMetrics } from "../../services/learnerProfile.service.js";
import { evaluateDifficulty } from "../../utils/testDifficulty.utils.js";
import { generateQuestions } from "../../services/questionGenerator.service.js";
import { isUserEligibleForRetest } from "../../utils/testCooldown.utils.js";
import { saveTest } from "../../services/testStorage.service.js";
import { Test } from "../../Models/test.model.js";
import { Topic } from "../../Models/CatalogModels/TopicModel.js";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { Session } from "../../Models/SessionModel.js";
import { Review } from "../../Models/ReviewModel.js";
import { User } from "../../Models/UserModels/UserModel.js";


/**
 * POST /api/tests/generate
 * Request Body: { userId: string, topicId: string }
 */
export const generateTest = async (req, res) => {
  try {
    const { topicId } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    if (!userId || !topicId) {
      return res.status(400).json({ success: false, message: "Missing userId or topicId." });
    }

    // 1. Fetch topic from catalogue
    const topic = await Topic.findByPk(topicId);
    // console.log('topic', topic);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ success: false, message: "Invalid topic." });
    }

    // 2. Get user metrics
    const learnerProfile = await getUserLearningMetrics(userId);

    // 3. Evaluate appropriate difficulty
    const difficulty = evaluateDifficulty(topic.topic_params, learnerProfile);

    let questionsCount = 20;
    // 4. Generate questions
    const { questions, answers } = await generateQuestions({
      learnerProfile,
      topicParams: topic.topic_params,
      topicName: topic.name,
      topicId,
      userId,
      count: questionsCount,
    });
    console.log('questions');
    console.log('questions', questions.length);
    const time_limit_minutes = (questions.length * 1.5);
    
    let count = await Test.count()+1;

    // 5. (Optional) Save test to DB or cache
    const savedTest = await Test.create({
      sl_no: count,
      topic_name: topic.name,
      user_id: userId,  
      topic_uuid: topicId,
      difficulty,
      topics: [{
        id: topic.id,
        name: topic.name,
        description: topic.description,
        session_count: topic.session_count,
        prices: topic.prices,
      }],
      questions, // contains id, text, options
      answers,   // only if you're storing them (optional)
      test_settings: {
        difficulty,
        time_limit_minutes,
        retest_wait: 5,
        fraud_risk_score: 0,
      },
      status: "generated",
    });

  
    return res.status(200).json({
      success: true,
      message: "Test generated successfully.",
      data: {
        test_id: savedTest.test_id,
        topicId,
        difficulty,
        time_limit_minutes,
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
    const submittedAnswers = req.body.answers || {};
    // Check if the test exists
    const test = await Test.findByPk(test_id);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    // Update status and timestamp
    if (test.status === "submitted" || test.status === "evaluated") {
      return res.status(400).json({
        success: false,
        message: `Test already ${test.status}. Cannot resubmit.`,
      });
    }
    test.answers_submitted = submittedAnswers; // You must have this column in your model
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

    const submittedAnswers = req.body.answers || {};
    const questions = test.questions || [];
    const correctAnswersArray = Array.isArray(test.answers) ? test.answers : [];

    const correctAnswerMap = {};
    for (const item of correctAnswersArray) {
      correctAnswerMap[item.id] = item.correct_answer;
    }
    debugger;
    const scoredResults = questions.map((question) => {
      const learnerAnswer = submittedAnswers[question.id];
      const correct = correctAnswerMap[question.id];
      const isCorrect = learnerAnswer === correct;

      return {
        question_id: question.id,
        learnerAnswer,
        correctAnswer: correct,
        score: isCorrect ? 1 : 0,
        correct: isCorrect,
      };
    });

    const totalScore = scoredResults.reduce((sum, q) => sum + q.score, 0);
    const maxScore = questions.length;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const passed = percentage >= 90;

    test.evaluation_result = {
      total_score: totalScore,
      max_score: maxScore,
      percentage,
      passed,
      details: scoredResults,
    };

    test.result = {
      percentage,
      passed,
    };

    test.status = "evaluated";

    // ✅ Set cooling period based on score
    let cooling_period = 14; // default 2 weeks
    if (percentage >= 80 && percentage < 90) {
      cooling_period = 7;
    }
    test.cooling_period = cooling_period;


    // ✅ If passed, add this topic to qualified topics
    if (passed) {
      test.eligible_for_bridger = true;
    
      const topicId = test.topic_uuid;
      const topic = await Topic.findByPk(topicId);
    
      if (topic) {
        const currentTeacherIds = Array.isArray(topic.qualified_teacher_ids) ? topic.qualified_teacher_ids : [];
        const currentTeacherNames = Array.isArray(topic.qualified_teacher_names) ? topic.qualified_teacher_names : [];
    
        if (!currentTeacherIds.includes(test.user_id)) {
          console.log("✅ Adding user to qualified_teachers:", test.user_id);

          const user = await User.findByPk(test.user_id, { attributes: ["id", "firstName"] });
          if (user) {

          const updatedTeacherIds = [...currentTeacherIds, test.user_id];
          const updatedNames = [...currentTeacherNames, user.firstName ];

          topic.set('qualified_teacher_ids', updatedTeacherIds);
          topic.set('qualified_teacher_names', updatedNames);
          await topic.save();

          const updatedTopic = await Topic.findByPk(topicId);
          console.log("✅ Updated qualified_teachers:", updatedTopic.qualified_teacher_ids);
          console.log("✅ Updated qualified_teacher_names:", updatedTopic.qualified_teacher_names);
        } else {
          console.log("❌ User not found to update teacher names.");
        }
        } else {
          console.log("⚡ User already present in qualified_teachers list.");
        }
      } else {
        console.log("❌ Topic not found!");
      }
    }    
    await test.save();

    return res.status(200).json({
      success: true,
      message: "Test evaluated",
      evaluation: test.evaluation_result,
      cooling_period_days: test.cooling_period, 
      eligible_for_bridger: test.eligible_for_bridger,
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
  

export async function getTestById(req, res) {
  try {
    const { testId } = req.params;
    const test = await Test.findByPk(testId);
    console.log('test id', testId);

    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    return res.json({
      success: true,
      data: {
        test_id: test.test_id,
        topic_uuid: test.topic_uuid,
        questions: test.questions,
        time_limit_minutes: test.test_settings?.time_limit_minutes || 30,
        created_at: test.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ getTestById failed:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
  

export const getQualifiedTopics = async (req, res) => {
  try {
    console.log('getQualifiedTopics called');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing or invalid token format" });
    }
    const token = req.headers.authorization?.split(" ")[1];
    console.log('token', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('decoded', decoded);
    const userId = decoded.id;

    const topics = await Topic.findAll({
      where: {
        qualified_teacher_ids: {
          [Op.contains]: [userId],
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: topics
    });

  } catch (err) {
    console.error("❌ Error fetching qualified topics:", err);
    res.status(500).json({ success: false, message: "Could not fetch qualified topics" });
  }
};



export const getTeachStats = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // ✅ 1. Count sessions where teacher_id matches
    const totalSessions = await Session.count({
      where: { teacher_id: userId, status: "completed" },
    });

    // ✅ 2. Fetch all reviews for this teacher
    const reviews = await Review.findAll({ where: { teacher_id: userId } });

    // ✅ 3. Calculate average rating
    const averageRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // ✅ 4. Earnings logic (replace with actual logic later)
    const sessionRate = 150;
    const totalEarnings = totalSessions * sessionRate;

    return res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        averageRating: Number(averageRating.toFixed(1)),
        totalSessions,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching /teach/stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch teaching stats",
      error: error.message,
    });
  }
};

export const getAnswersByTopic = async (req, res) => {
  try {
    const { topicId } = req.params;

    const test = await Test.findOne({
      where: {
        topic_uuid: topicId,
        status: "generated",
      },
      order: [["created_at", "DESC"]],
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "No evaluated test found for this topic",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        topic_name: test.topic_name,
        answers: test.answers,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching public answers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch answers",
      error: error.message,
    });
  }
};

