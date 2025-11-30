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
import { getRazorpayInstance } from "../PaymentControllers/paymentController.js";
import { getRandomSubset, isFarAway, shuffle } from "../../utils/questionReuse.utils.js";

/**
 * POST /api/tests/generate
 * Request Body: { userId: string, topicId: string }
 */

// Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });


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
const findUnusedSuccessfulPayment = async (userId, topicId, mode = null) => {
  const whereClause = {
    user_id: userId,
    entity_type: "test",
    entity_id: topicId,
    status: "success",
  };

  if (mode) {
    whereClause.payment_mode = mode;
  }

  const payment = await Payment.findOne({
    where: whereClause,
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
let { topicId, paymentMode } = req.body;

paymentMode = paymentMode === "LIVE" ? "LIVE" : "DEMO";
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
    // const amount = 9900; // ₹99 in paise
    const amount = 100; // ₹1 in paise
    const currency = "INR";

    // ✅ FIXED: Generate short receipt (≤40 characters)
    const receipt = generateReceiptId(topicId, userId);


    // Create Razorpay order
    // ✅ Use correct Razorpay instance based on mode
    const razorpay = getRazorpayInstance(paymentMode);
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        user_id: userId,
        topic_id: topicId,
        topic_name: topic.name,
        entity_type: "test",
  payment_mode: paymentMode === "LIVE" ? "live" : "test"
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
      payment_mode: paymentMode, 
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        key: (paymentMode === "LIVE") ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_KEY_ID,
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

    // Update payment record
    const payment = await Payment.findOne({
      where: {
        user_id: userId,
        entity_type: "test",
        entity_id: topicId,
        order_id: razorpay_order_id,
      },
      attributes: [...PAYMENT_ATTRS, "payment_mode"],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    const isLive = payment.payment_mode === "LIVE";
    const secret = isLive
      ? process.env.RAZORPAY_LIVE_KEY_SECRET
      : process.env.RAZORPAY_KEY_SECRET;

    // ✅ Verify signature with correct secret
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
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

    // 1️⃣ Already passed
    const passed = await Test.findOne({
      where: { user_id: userId, topic_uuid: topicId, eligible_for_bridger: true },
    });
    if (passed) {
      return res.status(200).json({
        success: true,
        data: {
          already_bridger: true,
          message: "You are already a Bridger for this topic.",
        },
      });
    }

    // 2️⃣ Cooling period
    const { eligible, waitTime, cooldown_end } = await isUserEligibleForRetest(userId, topicId);
    if (!eligible) {
      return res.status(200).json({
        success: true,
        data: {
          paid: true,
          cooldown_active: true,
          waitTime,
          cooldown_end,
          message: `You are still on cooldown. Next attempt available at ${cooldown_end}`,
        },
      });
    }

    // 3️⃣ Get latest payment and read its mode
    const recentPaymentTest = await Test.findOne({
      where: {
        user_id: userId,
        topic_uuid: topicId,
      },
      include: [{
        model: Payment,
        as: "payment",
        required: true,
        where: { status: "captured" },
      }],
      order: [["created_at", "DESC"]],
    });

    const mode = recentPaymentTest?.payment?.payment_mode ?? 'DEMO';

    const payment = await findUnusedSuccessfulPayment(userId, topicId, mode);

    return res.status(200).json({
      success: true,
      data: {
        paid: !!payment,
        payment_mode: mode,
        cooldown_active: false,
        already_bridger: false,
        amount_required: payment ? 0 : 100,
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

    console.log("🧪 Questions:", JSON.stringify(test.questions, null, 2));
    console.log("✅ Answers:", JSON.stringify(test.answers, null, 2));

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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const topics = await Teachertopicstats.findAll({
      where: { teacherId: userId },
      include: [
        {
          model: CatalogueNode,
          as: "catalogueNode",
          attributes: ["node_id", "name", "parent_id"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: topics || [],
    });
  } catch (err) {
    console.error("❌ Error fetching qualified topics:", err);
    res.status(500).json({
      success: false,
      message: "Could not fetch qualified topics",
      error: err.message,
    });
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
  try {
    const { userId } = req.user;
    const { topicId, payment_id, userLocation } = req.body;

    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found." });
    }

    // Step 1: Check if the user already attempted this topic
    const previousUserTest = await Test.findOne({
      where: { user_id: userId, topic_uuid: topicId },
      order: [["createdAt", "DESC"]],
    });

    if (previousUserTest) {
      console.log("♻️ Reusing questions from previous attempt by the same user");

      const reusedQs = getRandomSubset(previousUserTest.questions, 10);
      const reusedAns = getRandomSubset(previousUserTest.answers, 10);

      const newGen = await generateQuestions({ topicId, count: 10 });
      const mixedQs = shuffle([...reusedQs, ...newGen.questions]);
      const mixedAns = shuffle([...reusedAns, ...newGen.answers]);

      const savedTest = await saveTest({
        topic,
        userId,
        topicId,
        questions: mixedQs,
        answers: mixedAns,
        payment_id,
        userLocation,
      });

      return res.status(200).json({
        success: true,
        message: "Test generated using previous and new questions.",
        data: {
          test_id: savedTest.test_id,
          topicId,
          questions: mixedQs,
        },
      });
    }

    // Step 2: Check if other users have attempted this topic
    const otherTests = await Test.findAll({
      where: { topic_uuid: topicId },
      order: [["createdAt", "DESC"]],
    });

    if (otherTests.length > 0) {
      const otherUserTest = otherTests.find(t => t.user_id !== userId && t.questions?.length > 0);

      if (otherUserTest && isFarAway(userLocation, otherUserTest.user_location)) {
        console.log("🌍 Reusing shuffled questions from a distant user");

        const reusedQs = shuffle([...otherUserTest.questions]);
        const reusedAns = shuffle([...otherUserTest.answers]);

        const savedTest = await saveTest({
          topic,
          userId,
          topicId,
          questions: reusedQs,
          answers: reusedAns,
          payment_id,
          userLocation,
        });

        return res.status(200).json({
          success: true,
          message: "Test generated using distant user's questions.",
          data: {
            test_id: savedTest.test_id,
            topicId,
            questions: reusedQs,
          },
        });
      }
    }

    // Step 3: Pool reuse if 2+ users already took test
    if (otherTests.length >= 2) {
      console.log("📚 Shuffling from pool of previous users' questions");

      const allQs = otherTests.flatMap(t => t.questions).slice(0, 25);
      const allAns = otherTests.flatMap(t => t.answers).slice(0, 25);
      const poolQs = shuffle(allQs);
      const poolAns = shuffle(allAns);

      const savedTest = await saveTest({
        topic,
        userId,
        topicId,
        questions: poolQs,
        answers: poolAns,
        payment_id,
        userLocation,
      });

      return res.status(200).json({
        success: true,
        message: "Test generated using pooled questions from other users.",
        data: {
          test_id: savedTest.test_id,
          topicId,
          questions: poolQs,
        },
      });
    }

    // 🚀 Step 4: Generate new questions from GPT
    console.log("✨ Generating new questions via GPT");

    const generated = await generateQuestions({ topicId, count: 20 });

    const savedTest = await saveTest({
      topic,
      userId,
      topicId,
      questions: generated.questions,
      answers: generated.answers,
      payment_id,
      userLocation,
    });

    return res.status(200).json({
      success: true,
      message: "Fresh test generated.",
      data: {
        test_id: savedTest.test_id,
        topicId,
        questions: generated.questions,
      },
    });

  } catch (err) {
    console.error("❌ Error in generateTest:", err);
    return res.status(500).json({ success: false, message: "Server error." });
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
