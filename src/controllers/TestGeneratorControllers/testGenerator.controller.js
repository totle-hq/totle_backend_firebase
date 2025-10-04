// File: src/controllers/TestGeneratorControllers/testGenerator.controller.js

import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { getUserLearningMetrics } from "../../services/learnerProfile.service.js";
import { evaluateDifficulty } from "../../utils/testDifficulty.utils.js";
import { generateQuestions } from "../../services/questionGenerator.service.js";
import { isUserEligibleForRetest } from "../../utils/testCooldown.utils.js";
import { saveTest } from "../../services/testStorage.service.js";
import { Test } from "../../Models/test.model.js";
// import { Topic } from "../../Models/CatalogModels/TopicModel.js";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { Session } from "../../Models/SessionModel.js";
import { Review } from "../../Models/ReviewModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { TabSwitchEvent } from "../../Models/TabswitchModel.js";
import { TestFlag } from "../../Models/TestflagModel.js";
import { findSubjectAndDomain } from "../../utils/getsubject.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { Payment } from "../../Models/PaymentModels.js";
import { TestItemRubric } from "../../Models/TestItemRubric.model.js";
import { applyRubricsToTest } from "../../services/cps/applyRubricsToTest.service.js";
import { CPS_KEYS } from "../../services/cps/cpsKeys.js"; 

import {
  generateCpsQuestionSet,
  toFrontendView,
  toBackendEvalPack,
} from "../../services/cps/orchestrateCpsGeneration.service.js";
// import { CpsProfile } from "../../Models/CpsProfile.model.js"; // ❌ no longer used directly here
import { publishProgress } from "../../utils/progressBus.js";
import { sequelize1 } from "../../config/sequelize.js";

// ✅ Use your existing EWMA updater service
import { updateCpsProfileFromTest } from "../../services/cps/cpsEma.service.js";

/**
 * POST /api/tests/generate
 * Request Body: { userId: string, topicId: string }
 */

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Common list of Payment columns that actually exist in DB (exclude legacy session_id/snake_case)
const PAYMENT_ATTRS = [
  "payment_id",
  "user_id",
  "entity_type",
  "entity_id",
  "order_id",
  "razorpay_payment_id",
  "razorpay_signature",
  "amount",
  "currency",
  "status",
  "failure_reason",
  "createdAt",
  "updatedAt",
];

// ✅ Find the latest successful payment that hasn't been used to create a Test
const findUnusedSuccessfulPayment = async (userId, topicId) => {
  // Find latest success payment for this user+topic
  const payment = await Payment.findOne({
    where: {
      user_id: userId,
      entity_type: "test",
      entity_id: topicId,
      status: "success",
    },
    attributes: PAYMENT_ATTRS,
    order: [["createdAt", "DESC"]],
  });

  if (!payment) return null;

  // Check if this payment is already linked to a Test
  const used = await Test.findOne({ where: { payment_id: payment.payment_id } });
  if (used) return null;

  return payment;
};

// ✅ Backward-compat boolean check (kept for endpoints that only need a yes/no)
const checkTestPayment = async (userId, topicId) => {
  const p = await findUnusedSuccessfulPayment(userId, topicId);
  return !!p;
};

const generateReceiptId = (topicId, userId) => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits
  const topicShort = topicId.slice(-8); // Last 8 chars of topic ID
  const userShort = userId.slice(-8); // Last 8 chars of user ID
  return `t_${topicShort}_${userShort}_${timestamp}`.slice(0, 40);
};

// ---- param helper (so routes can use :test_id OR :testId OR :sessionId, etc.) ----
const param = (req, ...names) => {
  for (const n of names) if (req.params && req.params[n] != null) return req.params[n];
  return undefined;
};

// ✅ NEW: Initiate payment for test
export const initiateTestPayment = async (req, res) => {
  try {
    const { topicId } = req.body;
    const userId = req.user.id;

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: "Topic ID is required",
      });
    }

    // Check if user already has a successful payment for this test
    const existingPayment = await checkTestPayment(userId, topicId);
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this test",
      });
    }

    // Verify topic exists
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({
        success: false,
        message: "Invalid topic",
      });
    }

    const amount = 9900; // ₹99 in paise
    const currency = "INR";

    // ✅ FIXED: Generate short receipt (≤40 characters)
    const receipt = generateReceiptId(topicId, userId);

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        user_id: userId,
        topic_id: topicId,
        topic_name: topic.name,
        entity_type: "test",
      },
    });

    // Save payment record
    const payment = await Payment.create({
      user_id: userId,
      entity_type: "test",
      entity_id: topicId,
      order_id: order.id,
      amount,
      currency,
      status: "created",
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        key: process.env.RAZORPAY_KEY_ID,
        order_id: order.id,
        amount,
        currency,
        topic_name: topic.name,
        payment_id: payment.payment_id,
      },
    });
  } catch (error) {
    console.error("❌ Error initiating test payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message,
    });
  }
};

export const verifyTestPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, topicId } = req.body;

    const userId = req.user.id;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Update payment record
    const payment = await Payment.findOne({
      where: {
        user_id: userId,
        entity_type: "test",
        entity_id: topicId,
        order_id: razorpay_order_id,
      },
      attributes: PAYMENT_ATTRS,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    payment.razorpay_payment_id = razorpay_payment_id;
    payment.razorpay_signature = razorpay_signature;
    payment.status = "success";
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        payment_id: payment.payment_id,
        status: "success",
      },
    });
  } catch (error) {
    console.error("❌ Error verifying test payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

export const checkTestPaymentStatus = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    const payment = await findUnusedSuccessfulPayment(userId, topicId);

    return res.status(200).json({
      success: true,
      data: {
        paid: !!payment,
        amount_required: payment ? 0 : 9900,
      },
    });
  } catch (error) {
    console.error("❌ Error checking payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message,
    });
  }
};

export const startTest = async (req, res) => {
  try {
    const testId = param(req, "test_id", "testId", "sessionId");
    const userId = req.user.id;

    const test = await Test.findByPk(testId);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    if (test.user_id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Payment used to create this test must be valid and belong to the user
    const payment = await Payment.findOne({
      where: { payment_id: test.payment_id, user_id: userId, status: "success" },
      attributes: PAYMENT_ATTRS,
    });
    if (!payment) {
      return res.status(402).json({
        success: false,
        message: "Payment validation failed for this test.",
        payment_required: true,
      });
    }

    // Cooldown guard
const { eligible, waitTime, cooldown_end } = await isUserEligibleForRetest(userId, test.topic_uuid);
if (!eligible) {
  return res.status(429).json({
    success: false,
    message: `You are still on cooldown. Next attempt available at ${cooldown_end}`,
    cooldown_active: true,
    waitTime,
    cooldown_end,
  });
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

export const submitTest = async (req, res) => {
  try {
    const testId = param(req, "test_id", "testId", "sessionId");
    const submittedAnswers = req.body.answers || {};
    const question_timings = req.body.timing || {};

    const test = await Test.findByPk(testId);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    if (test.status === "submitted" || test.status === "evaluated") {
      return res.status(400).json({
        success: false,
        message: `Test already ${test.status}. Cannot resubmit.`,
      });
    }

    test.answers_submitted = submittedAnswers;
    test.status = "submitted";
    test.submitted_at = new Date();
    test.question_timings = question_timings;
    await test.save();

    return res.status(200).json({ success: true, message: "Test submitted successfully", data: test });
  } catch (error) {
    console.error("❌ Error submitting test:", error);
    return res.status(500).json({ success: false, message: "Failed to submit test", error: error.message });
  }
};

export const evaluateTest = async (req, res) => {
  const testId = param(req, "test_id", "testId", "sessionId");

  try {
    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    if (test.status !== "submitted") {
      return res.status(400).json({ success: false, message: "Only submitted tests can be evaluated" });
    }

    /* ------------------ 1) Score the test ------------------ */
    const submittedAnswers = req.body.answers || test.answers_submitted || {};
    const questions = Array.isArray(test.questions) ? test.questions : [];
    const correctAnswersArray = Array.isArray(test.answers) ? test.answers : [];

    const correctAnswerMap = {};
    for (const item of correctAnswersArray) {
      correctAnswerMap[item.id] = item.correct_answer;
    }

    const scoredResults = questions.map((q) => {
      const learnerAnswer = submittedAnswers[q.id];
      const correct = correctAnswerMap[q.id];
      const isCorrect = learnerAnswer === correct;
      return {
        question_id: q.id,
        learnerAnswer,
        correctAnswer: correct,
        score: isCorrect ? 1 : 0,
        correct: isCorrect,
      };
    });


const totalScore = scoredResults.reduce((s, q) => s + q.score, 0);
const maxScore = questions.length;
const percentage = Math.round((totalScore / maxScore) * 100);

// ✅ Pass rule: ≥90% always passes (ignore gates)
const passed = percentage >= 90;

/* ------------------ 2) Apply rubrics (option impacts) ------------------ */
let deltas = {};
let gates = { teachingGatePassed: true, resilienceGatePassed: true };

try {
  const { deltas: d, gates: g } = await applyRubricsToTest(testId);
  deltas = d || {};
  gates = g || gates;
} catch (rubErr) {
  console.error("⚠️ Rubric application failed:", rubErr?.message || rubErr);
}

// ✅ Ensure all 47 CPS params are present
const cpsScores100 = {};
for (const key of CPS_KEYS) {
  cpsScores100[key] = Number.isFinite(deltas[key]) ? deltas[key] : 0;
}

// ✅ Gates logged for analytics, but not blocking pass/fail
const teachingGatePassed = gates.teachingGatePassed;
const resilienceGatePassed = gates.resilienceGatePassed;
const gatedPass = passed;


    /* ------------------ 4) Cooling period ------------------ */
    let cooling_period_days = 0;
    if (percentage >= 80 && percentage < 90) cooling_period_days = 7;
    else if (percentage < 80) cooling_period_days = 14;

    test.cooling_period = cooling_period_days;
    let cooling_period_end = null;
    if (cooling_period_days > 0) {
      const submittedAt = test.submitted_at ? new Date(test.submitted_at) : new Date();
      cooling_period_end = new Date(submittedAt.getTime() + cooling_period_days * 86400000);
    }

    /* ------------------ 5) Save metrics ------------------ */
    const perf = { ...(test.performance_metrics || {}) };
    perf.evaluation_details = scoredResults;
perf.param_deltas = cpsScores100;
    perf.cps_scores = cpsScores100;
    perf.gates = { teachingGatePassed, resilienceGatePassed };
    test.performance_metrics = perf;

    test.result = {
      percentage,
      passed: gatedPass,
      cps_scores: cpsScores100,
    };
    test.status = "evaluated";

    /* ------------------ 6) Mark eligible teachers ------------------ */
    if (gatedPass) {
      test.eligible_for_bridger = true;
      const topicId = test.topic_uuid;
      const topic = await CatalogueNode.findByPk(topicId);
      const teacherId = test.user_id;

      const statExists = await Teachertopicstats.findOne({ where: { teacherId, node_id: topicId } });
      if (!statExists) {
        await Teachertopicstats.create({
          teacherId,
          node_id: topicId,
          tier: "free",
          level: "Bridger",
          sessionCount: 0,
          rating: 0,
        });
      }

      if (topic) {
        const currentTeacherIds = Array.isArray(topic.qualified_teacher_ids) ? topic.qualified_teacher_ids : [];
        const currentTeacherNames = Array.isArray(topic.qualified_teacher_names) ? topic.qualified_teacher_names : [];
        if (!currentTeacherIds.includes(test.user_id)) {
          const user = await User.findByPk(test.user_id, { attributes: ["id", "firstName"] });
          if (user) {
            topic.set("qualified_teacher_ids", [...currentTeacherIds, test.user_id]);
            topic.set("qualified_teacher_names", [...currentTeacherNames, user.firstName]);
            await topic.save();
          }
        }
      }
    }

    await test.save();

    /* ------------------ 7) Update CPS profile via EMA ------------------ */
    try {
      await updateCpsProfileFromTest({
        testId: test.test_id,
        userId: test.user_id,
  deltas: cpsScores100,   // 👈 use normalized full set
        alpha: 0.4,
        firstTestSetsBaseline: true,
      });
    } catch (ewmaErr) {
      console.error("⚠️ EWMA update failed (non-fatal):", ewmaErr?.message || ewmaErr);
    }

    /* ------------------ 8) Response ------------------ */
    return res.status(200).json({
      success: true,
      message: "Test evaluated",
      evaluation: { total_score: totalScore, max_score: maxScore, percentage, gatedPass },
      cooling_period_days: test.cooling_period,
      cooling_period_end,
      eligible_for_bridger: test.eligible_for_bridger,
    });
  } catch (error) {
    console.error("❌ Error evaluating test:", error);
    return res.status(500).json({ success: false, message: "Failed to evaluate test", error: error.message });
  }
};


export const checkUserTestEligibility = async (req, res) => {
  try {
    const topicId = param(req, "topicId", "id");
    const userId = req.user.id;

    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    if (!topicId) return res.status(400).json({ success: false, message: "Missing topicId" });

const { eligible, waitTimeMinutes, cooldown_end } = await isUserEligibleForRetest(userId, topicId);
return res.status(200).json({ success: true, data: { eligible, waitTimeMinutes, cooldown_end } });

  } catch (error) {
    console.error("❌ Error checking retest eligibility:", error);
    return res.status(500).json({ success: false, message: "Failed to check eligibility", error: error.message });
  }
};

export const checkRetestEligibility = async (req, res) => {
  try {
    const topicId = param(req, "topicId", "id");
    const userId = req.user.id;

    if (!userId || !topicId) {
      return res.status(400).json({ success: false, message: "Missing userId or topicId" });
    }
const { eligible, waitTime, cooldown_end } = await isUserEligibleForRetest(userId, topicId);

return res.status(200).json({
  success: true,
  eligible,
  waitTime,
  cooldown_end,
  message: eligible
    ? "User is eligible to retake the test."
    : `User is currently on cooldown. Next attempt available at ${cooldown_end}`,
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
      order: [["createdAt", "DESC"]],
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
    const testId = param(req, "testId", "sessionId", "test_id");
    const test = await Test.findByPk(testId);

    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

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
    console.log("get Qualified Topics called");
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing or invalid token format" });
    }
    const token = req.headers.authorization?.split(" ")[1];
    console.log("token", token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded", decoded);
    const userId = decoded.id;

    const topics = await Teachertopicstats.findAll({
      where: { teacherId: userId },
      include: [
        {
          model: CatalogueNode,
          as: "catalogueNode",
          attributes: ["node_id", "name", "parent_id"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: topics,
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
        status: "evaluated",
      },
      order: [["createdAt", "DESC"]],
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

// to post the cheat detail like:reload or switch the tab on the time of test
export const logCheatEvent = async (req, res) => {
  try {
    const { test_id, type } = req.body;
    const user_id = req.user.id;

    if (!test_id || !type) {
      return res.status(400).json({ success: false, message: "Missing test_id or event type" });
    }

    const event = await TabSwitchEvent.create({ test_id, user_id, type });

    return res.status(201).json({ success: true, event });
  } catch (err) {
    console.error("❌ Error logging cheat event:", err);
    res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};

// to get test detail from tabswitchevent model
export const getCheatLogs = async (req, res) => {
  try {
    const { test_id } = req.query;
    const logs = await TabSwitchEvent.findAll({ where: { test_id } });

    return res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error("❌ Error fetching logs:", err);
    res.status(500).json({ success: false });
  }
};

export const reportQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId, questionId, reason } = req.body;

    // Basic validation
    if (!testId || !questionId || !reason) {
      return res.status(400).json({
        success: false,
        message: "testId, questionId, and reason are required.",
      });
    }

    // Verify test belongs to user
    const test = await Test.findOne({
      where: { test_id: testId, user_id: userId },
    });

    if (!test) {
      return res.status(403).json({
        success: false,
        message: "Test not found or access denied.",
      });
    }

    // Check if question exists in the test
    const questionExists = test.questions?.some((q) => q.id === questionId);

    if (!questionExists) {
      return res.status(404).json({
        success: false,
        message: "Question not found in the test.",
      });
    }

    // Save flag to DB
    const flag = await TestFlag.create({
      user_id: userId,
      test_id: testId,
      question_id: questionId,
      reason,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Question flagged successfully.",
      data: flag,
    });
  } catch (err) {
    console.error("❌ Error reporting question:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const reportTest = async (req, res) => {
  try {
    const { testId, reason } = req.body;
    const userId = req.user.id;

    const test = await Test.findByPk(testId);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    const report = await TestFlag.create({
      test_id: testId,
      user_id: userId,
      reason,
      status: "open",
    });

    return res.status(201).json({ success: true, message: "Test reported", data: report });
  } catch (err) {
    console.error("❌ Error reporting test:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



export const generateTest = async (req, res) => {
  console.log("🔹 [generateTest] Request received", { body: req.body, userId: req?.user?.id });

  try {
    const { topicId } = req.body;
    const userId = req.user.id;
    console.log("➡️ Extracted params", { userId, topicId });

    if (!userId || !topicId) {
      console.warn("⚠️ Missing params", { userId, topicId });
      return res.status(400).json({ success: false, message: "Missing userId or topicId." });
    }

    console.log("🔹 Checking payment gate");
    const hasValidPayment = await checkTestPayment(userId, topicId);
    console.log("✅ Payment check result:", hasValidPayment);
    if (!hasValidPayment) {
      return res.status(402).json({
        success: false,
        message: "Payment required to take this test. Please pay ₹99 to continue.",
        payment_required: true,
        amount: 9900,
      });
    }

    console.log("🔹 Checking cooldown for user", userId, "topic", topicId);
const { eligible, waitTime, cooldown_end } = await isUserEligibleForRetest(userId, topicId);
if (!eligible) {
  return res.status(429).json({
    success: false,
    message: `You are still on cooldown. Next attempt available at ${cooldown_end}`,
    cooldown_active: true,
    waitTime,
    cooldown_end,
  });
}


    console.log("🔹 Fetching subject/domain for topic", topicId);
    const { subject, domain } = await findSubjectAndDomain(topicId);
    const subjectName = subject?.name || "";
    const subjectDescription = subject?.description || "";
    const domainName = domain?.name || "";
    const domainDescription = domain?.description || "";
    console.log("✅ Subject/Domain fetched:", { subjectName, domainName });

    console.log("🔹 Fetching topic from DB", topicId);
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ success: false, message: "Invalid topic." });
    }
    console.log("✅ Topic found:", topic.name);
    const topicDescription = topic.description || "";

    const topicParams = {
      ...(topic?.computed_cps_weights || {}),
      ...(topic?.recommended_item_mix || {}),
      ...(topic?.recommended_time_pressure ? { recommended_time_pressure: topic.recommended_time_pressure } : {}),
      ...(topic?.metadata || {}),
    };

    const domainParams = {
      ...(domain?.domain_cognitive_profile || {}),
      ...(domain?.knowledge_type_mix || {}),
      ...(domain?.modality_mix || {}),
    };

    console.log("🔹 Checking if baseline test for this user/topic");
    // const priorCount = await Test.count({ where: { user_id: userId, topic_uuid: topicId } });
    // const isBaseline = priorCount === 0;
    // console.log("✅ Prior tests:", priorCount, "| Mode:", isBaseline ? "Baseline" : "CPS");
    const priorCount = await Test.count({ where: { user_id: userId, topic_uuid: topicId } });
console.log("✅ Prior tests:", priorCount, "| Mode: forced baseline");
const isBaseline = true;   // ✅ force baseline regardless


    console.log("🔹 Fetching learner profile for user", userId);
    const learnerProfile = await getUserLearningMetrics(userId);
    console.log("✅ Learner profile fetched");

    console.log("🔹 Sending SSE initial note");
    publishProgress({
      userId,
      topicId,
      phase: "connect",
      status: "ok",
      note: isBaseline ? "Baseline: preparing a 20-item test…" : "Preparing CPS-aware test (7 blocks)…",
    });

    let flatQuestions = [];
    let flatAnswers = [];
    let time_limit_minutes = 30;
    const rubricRows = [];

    if (isBaseline) {
      console.log("🔹 Using baseline generator (20 questions)");
      const result = await generateQuestions({
        subject: subjectName,
        subjectDescription,
        domain: domainName,
        domainDescription,
        topicName: topic.name,
        topicDescription,
        learnerProfile,
        topicParams,
        subtopics: [],
        topicId,
        userId,
        count: 20,
      });

      time_limit_minutes = result.time_limit_minutes || 30;
      let globalId = 1;

      for (const item of result.questions) {
        flatQuestions.push({ id: globalId, text: item.text, options: item.options });
        flatAnswers.push({ id: globalId, correct_answer: result.answers.find(a => a.id === item.id)?.correct_answer });
        rubricRows.push({
          block_key: "baseline",
          global_qid: globalId,
          option_impacts: { A:{}, B:{}, C:{}, D:{} },
          gates: {},
          item_weight: 1.0,
        });
        globalId++;
      }

      if (flatQuestions.length < 20) {
        return res.status(500).json({
          success: false,
          message: `Baseline generation failed. Got only ${flatQuestions.length}/20 questions.`,
        });
      }
    } else {
      console.log("🔹 CPS generation started");
      const onProgress = (evt) => {
        publishProgress({ userId, topicId, ...evt });
      };

      const result = await generateCpsQuestionSet({
        subject: subjectName,
        subjectDescription,
        domain: domainName,
        domainDescription,
        topicName: topic.name,
        topicDescription,
        subtopics: [],
        learnerProfile,
        params: { topicParams, domainParams },
        isBaseline: false,
        onProgress,
      });

      time_limit_minutes = result.totalRecommendedTimeMin || 35;
      let globalId = 1;
      for (const step of result.steps) {
        for (const item of step.items) {
          flatQuestions.push({ id: globalId, text: item.text, options: item.options });
          flatAnswers.push({ id: globalId, correct_answer: item.answer });

          const safeImpacts = {};
          for (const opt of ["A", "B", "C", "D"]) {
            const entry = item?.rubric?.option_impacts?.[opt] || {};
            const clean = {};
            for (const [k, v] of Object.entries(entry)) {
              const num = Number(v);
              if (Number.isFinite(num)) clean[k] = num;
            }
            safeImpacts[opt] = clean;
          }

          rubricRows.push({
            block_key: step.key,
            global_qid: globalId,
            option_impacts: safeImpacts,
            gates: item?.rubric?.gates || {},
            item_weight: 1.0,
          });
          globalId++;
        }
      }

      if (flatQuestions.length !== 25) {
        return res.status(500).json({
          success: false,
          message: "Generator did not return 25 questions (CPS path).",
        });
      }

      publishProgress({
        userId,
        topicId,
        phase: "done",
        status: "progress",
        note: "CPS questions and rubrics ready.",
      });
    }

    console.log("🔹 Checking for unused payment");
    const payment = await findUnusedSuccessfulPayment(userId, topicId);
    if (!payment) {
      return res.status(402).json({
        success: false,
        message: "No unused successful payment found for this test. Please complete a new payment.",
        payment_required: true,
      });
    }

    console.log("🔹 Persisting Test row");
    const count = (await Test.count()) + 1;
    const savedTest = await Test.create({
      sl_no: count,
      topic_name: topic.name,
      user_id: userId,
      topic_uuid: topicId,
      difficulty: isBaseline ? "baseline" : "mixed",
      topics: [{ id: topic.id, name: topic.name, description: topic.description, session_count: topic.session_count, prices: topic.prices }],
      questions: flatQuestions,
      answers: flatAnswers,
      test_settings: {
        difficulty: isBaseline ? "baseline" : "mixed",
        time_limit_minutes,
        retest_wait: 5,
        fraud_risk_score: 0,
        cps_baseline: isBaseline,
      },
      status: "generated",
      payment_id: payment.payment_id,
    });
    console.log("✅ Test saved with id", savedTest.test_id);

    if (rubricRows.length) {
      console.log("🔹 Persisting rubrics:", rubricRows.length);
      await TestItemRubric.bulkCreate(
        rubricRows.map((row) => ({
          test_id: savedTest.test_id,
          block_key: row.block_key,
          global_qid: row.global_qid,
          option_impacts: row.option_impacts,
          gates: row.gates,
          item_weight: row.item_weight ?? 1,
        })),
        { validate: true }
      );
      console.log("✅ Rubrics persisted");
    }

    console.log("🎉 Test generation complete", savedTest.test_id);
    publishProgress({ userId, topicId, phase: "done", status: "done", note: "Test ready." });

    return res.status(200).json({
      success: true,
      message: "Test generated successfully.",
      data: {
        test_id: savedTest.test_id,
        topicId,
        difficulty: isBaseline ? "baseline" : "mixed",
        time_limit_minutes,
        questions: flatQuestions,
      },
    });
  } catch (error) {
    console.error("❌ Error generating test:", error);
    try {
      const { topicId } = req.body || {};
      const userId = req?.user?.id;
      if (userId && topicId) {
        publishProgress({ userId, topicId, phase: "error", status: "error", note: "Generation failed." });
      }
    } catch (innerErr) {
      console.error("⚠️ SSE error reporting failed:", innerErr);
    }
    return res.status(500).json({ success: false, message: "Failed to generate test.", error: error.message });
  }
};


// Add to: src/controllers/TestGeneratorControllers/testGenerator.controller.js
export const getTestReview = async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    if (test.status !== "evaluated") {
      return res.status(400).json({ success: false, message: "Test has not been evaluated yet" });
    }

    const questions = Array.isArray(test.questions) ? test.questions : [];
    const submittedAnswers = test.answers_submitted || {};
    const correctAnswersArray = Array.isArray(test.answers) ? test.answers : [];

    const correctAnswerMap = {};
    for (const item of correctAnswersArray) {
      correctAnswerMap[item.id] = item.correct_answer;
    }

    const reviewData = questions.map((q) => {
      const submitted = submittedAnswers[q.id];
      const correct = correctAnswerMap[q.id];

      return {
        question_id: q.id,
        question_text: q.text,
        selected_option: submitted ?? null,
        correct_answer: correct ?? null,
        is_correct: submitted === correct,
      };
    });

    return res.status(200).json({
      success: true,
      data: reviewData,
    });
  } catch (err) {
    console.error("❌ Error in getTestReview:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
