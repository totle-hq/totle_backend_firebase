// File: src/controllers/TestGeneratorControllers/testGenerator.controller.js

import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { getUserLearningMetrics } from "../../services/learnerProfile.service.js";
import { evaluateDifficulty } from "../../utils/testDifficulty.utils.js";
// import { generateQuestions } from "../../services/questionGenerator.service.js";
import { generateQuestionsForDimension } from "../../services/questionGenerator.service.js";
import { isUserEligibleForRetest } from "../../utils/testCooldown.utils.js";
import { saveTest } from "../../services/testStorage.service.js";
import { Test } from "../../Models/test.model.js";
// import { Topic } from "../../Models/CatalogModels/TopicModel.js";
import jwt from "jsonwebtoken";
import { Op, UUID, UUIDV4 } from "sequelize";
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
import { UserDevice } from "../../Models/UserModels/userDevice.model.js"

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
import { QuestionPool } from "../../Models/Fallback/QuestionsPool.js";
import { TopicQuestionPoolMeta } from "../../Models/Fallback/TopicQuestionPoolMeta.model.js";

/**
 * POST /api/tests/generate
 * Request Body: { userId: string, topicId: string }
 */

/**
 * CONSTANTS
 */
const REQUIRED_TOTAL = 25;
const BUFFER_PER_DIMENSION = 2;
const MAX_USAGE = 3;

const LEARNER_TOTAL_REQUIRED = 20;
const TEACHER_SCORE_REQUIRED = 5;
const DEFAULT_TIME_LIMIT_MINUTES = 30;

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
console.log("💰 initiateTestPayment called with:", { topicId, paymentMode });

paymentMode = paymentMode === "LIVE" ? "LIVE" : "DEMO";
// paymentMode = "DEMO";
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

    let payment_mode = recentPaymentTest?.payment?.payment_mode || null;
    let topic_price = null;

    // 4️⃣ If no recent test, fallback to node settings
    if (!payment_mode) {
      const node = await CatalogueNode.findByPk(topicId);
      payment_mode = node?.payment_mode || 'DEMO'; // fallback to DEMO
      topic_price = node?.topic_price ?? 99; // fallback to 99
    }

    // 5️⃣ Check if there's still an unused successful payment
    const payment = await findUnusedSuccessfulPayment(userId, topicId, payment_mode);

    return res.status(200).json({
      success: true,
      data: {
        paid: !!payment,
        payment_mode,
        cooldown_active: false,
        already_bridger: false,
        amount_required: payment ? 0 : topic_price ?? 99,
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

    test.status = "ongoing";
    test.started_at = new Date();
    await test.save();

    return res.status(200).json({ success: true, message: "Test started", data: test });
  } catch (error) {
    console.error("❌ Error starting test:", error);
    return res.status(500).json({ success: false, message: "Failed to start test", error: error.message });
  }
};

//without logs
// export const submitTest = async (req, res) => {
//   try {
//     const testId = param(req, "test_id", "testId", "sessionId");
//     const submittedAnswers = req.body.answers || {};
//     const question_timings = req.body.timing || {};

//     const test = await Test.findByPk(testId);
//     if (!test) return res.status(404).json({ success: false, message: "Test not found" });

//     if (test.status === "submitted" || test.status === "evaluated") {
//       return res.status(400).json({
//         success: false,
//         message: `Test already ${test.status}. Cannot resubmit.`,
//       });
//     }

//     test.answers_submitted = submittedAnswers;
//     test.status = "submitted";
//     test.submitted_at = new Date();
//     test.question_timings = question_timings;
//     await test.save();

//     return res.status(200).json({ success: true, message: "Test submitted successfully", data: test });
//   } catch (error) {
//     console.error("❌ Error submitting test:", error);
//     return res.status(500).json({ success: false, message: "Failed to submit test", error: error.message });
//   }
// };

// with logs
export const submitTest = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("📝 [submitTest] Request received", {
      params: req.params,
      userId: req.user?.id,
    });

    const testId = param(req, "test_id", "testId", "sessionId");
    const submittedAnswers = req.body.answers || {};
    const question_timings = req.body.timing || {};

    console.log("🧪 [submitTest] Parsed payload", {
      testId,
      answersCount: Object.keys(submittedAnswers).length,
      timingsCount: Object.keys(question_timings).length,
    });

    // 🔒 ATOMIC UPDATE — submit only if still ongoing
    const [affectedRows] = await Test.update(
      {
        answers_submitted: submittedAnswers,
        question_timings,
        status: "submitted",
        submitted_at: new Date(),
      },
      {
        where: {
          test_id: testId,
          status: ["generated", "ongoing"]
        },
      }
    );

    // ❌ Nothing updated → already submitted / evaluated / not found
    if (affectedRows === 0) {
      const test = await Test.findByPk(testId);

      if (!test) {
        console.warn("⚠️ [submitTest] Test not found", { testId });
        return res.status(404).json({
          success: false,
          message: "Test not found",
        });
      }

      console.warn("ℹ️ [submitTest] Duplicate submit attempt", {
        testId,
        status: test.status,
      });

      if (test.status === "submitted") {
        return res.status(200).json({
          success: true,
          message: "Test already submitted",
          data: test,
        });
      }

      if (test.status === "evaluated") {
        return res.status(400).json({
          success: false,
          message: "Test already evaluated. Cannot resubmit.",
        });
      }

      // Fallback (should never happen)
      return res.status(409).json({
        success: false,
        message: "Test cannot be submitted in current state",
      });
    }

    // ✅ Fetch updated test for response
    const updatedTest = await Test.findByPk(testId);

    console.log("✅ [submitTest] Test submitted successfully", {
      testId,
      durationMs: Date.now() - startTime,
    });

    return res.status(200).json({
      success: true,
      message: "Test submitted successfully",
      data: updatedTest,
    });
  } catch (error) {
    console.error("❌ [submitTest] Error submitting test", {
      message: error.message,
      stack: error.stack,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to submit test",
      error: error.message,
    });
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

    /* ------------------ 2) Split questions ------------------ */
    const learnerQuestions = [];
    const teacherScoreQuestions = [];

    for (const q of questions) {
      if (q.dimension === "teacher_score") {
        teacherScoreQuestions.push(q);
      } else {
        learnerQuestions.push(q);
      }
    }


    const scoredResults = learnerQuestions.map((q) => {
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

    const teacherScoreEvaluation = teacherScoreQuestions.map((q) => {
      const learnerAnswer = submittedAnswers[q.id];
      const correct = correctAnswerMap[q.id];
      return {
        question_id: q.id,
        learnerAnswer,
        correctAnswer: correct,
        correct: learnerAnswer === correct,
      };
    });

    const totalScore = scoredResults.reduce((s, q) => s + q.score, 0);
    const maxScore = learnerQuestions.length;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

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
    // Get teacher_score separately, don't mix with CPS_KEYS
    const teacherScore = deltas?.teacher_score ?? null;

    // Create CPS scores from only CPS_KEYS
    const cpsScores100 = {};
    for (const key of CPS_KEYS) {
      cpsScores100[key] = Number.isFinite(deltas[key]) ? deltas[key] : 0;
    }

    // Save metrics
    const perf = { ...(test.performance_metrics || {}) };
    perf.evaluation_details = scoredResults;
    perf.param_deltas = cpsScores100;
    perf.cps_scores = cpsScores100;
    perf.teacher_score_evaluation = {
      total: teacherScoreEvaluation.length,
      correct: teacherScoreEvaluation.filter(e => e.correct).length,
      details: teacherScoreEvaluation,
    };


    // ✅ Add teacher_score separately (without disturbing evaluation logic)
    if (teacherScore !== null) {
      perf.teacher_score = teacherScore;
    }

    // ✅ Gates logged for analytics, but not blocking pass/fail
    const teachingGatePassed = gates.teachingGatePassed;
    const resilienceGatePassed = gates.resilienceGatePassed;
    perf.gates = { teachingGatePassed, resilienceGatePassed };
    const gatedPass = passed;
    test.performance_metrics = perf;
    test.performance_metrics = perf;
    test.score = totalScore;
    test.percentage = percentage;
    test.evaluated_result_status = gatedPass ? "Pass" : "Fail";


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
      evaluation: { total_score: totalScore, max_score: maxScore, percentage, gatedPass, correct_answers: totalScore },
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

function dedupeById(arr, options = {}) {
  const {
    allowUndefined = false,
    allowNull = false,
    idKey = "id"
  } = options;

  const map = new Map();

  for (const item of arr) {
    const id = item[idKey];

    // Optional filtering: skip if correct_answer is undefined/null
    if (!allowUndefined && "correct_answer" in item && item.correct_answer === undefined) continue;
    if (!allowNull && "correct_answer" in item && item.correct_answer === null) continue;

    if (!map.has(id)) {
      map.set(id, item);
    } else {
      console.warn(`⚠️ Duplicate ${idKey} detected: ${id}. Skipping.`);
    }
  }

  return Array.from(map.values());
}

export async function selectQuestionsWithOneDifferencePerDimension({
  topic_uuid,
  dimension,
  count = 4,
  transaction,
}) {
  // Step 1: Get eligible non-buffer pool questions
  const poolQuestions = await QuestionPool.findAll({
    where: {
      topic_uuid,
      dimension,
      is_buffer: false,
      usage_count: { [Op.lt]: MAX_USAGE },
    },
    order: sequelize1.literal("RANDOM()"), // Shuffled selection
    transaction,
  });

  if (poolQuestions.length < count - 1) {
    console.warn(`⚠️ Not enough pool questions. Need ${count - 1}, got ${poolQuestions.length}`);
    return await regenerateDimension(topic_uuid, dimension, count, transaction);
  }

  // Step 2: Pick N-1 from pool
  const selectedMain = poolQuestions.slice(0, count - 1);

  // Step 3: Try to find a unique 1-question difference
  const buffer = await QuestionPool.findAll({
    where: {
      topic_uuid,
      dimension,
      is_buffer: true,
      usage_count: { [Op.lt]: MAX_USAGE },
    },
    order: Sequelize.literal("RANDOM()"),
    limit: 1,
    transaction,
  });

  let oneDiff;
  if (buffer.length > 0) {
    oneDiff = buffer[0];
  } else {
    console.warn(`⚠️ No fallback buffer left for ${dimension}. Regenerating...`);
    const topic = await CatalogueNode.findByPk(topic_uuid);
    const newQs = await generateQuestionsForDimension({
      topic_uuid,
      topicName: topic.name, // Replace if you have mapping
      dimension,
      count: 1,
    });

    if (newQs?.[0]) {
      oneDiff = await QuestionPool.create(
        {
          topic_uuid,
          dimension,
          question: { text: newQs[0].text, options: newQs[0].options },
          correct_answer: newQs[0].correct_answer,
          usage_count: 0,
          is_buffer: true,
        },
        { transaction }
      );
    } else {
      throw new Error(`❌ Failed to get 1-question difference for ${dimension}`);
    }
  }

  const finalSet = shuffleArray([...selectedMain, oneDiff]);
  return finalSet;
}

async function regenerateDimension(topic_uuid, dimension, count, transaction) {
  const topic = await CatalogueNode.findByPk(topic_uuid);
  const newQs = await generateQuestionsForDimension({
    topic_uuid,
    topicName: topic.name, // Map topic_uuid if possible
    dimension,
    count,
  });

  const created = await Promise.all(
    newQs.map((q) =>
      QuestionPool.create(
        {
          topic_uuid,
          dimension,
          question: { text: q.text, options: q.options },
          correct_answer: q.correct_answer,
          usage_count: 0,
          is_buffer: false,
        },
        { transaction }
      )
    )
  );

  return created;
}

async function ensureQuestionPool(topic_uuid, userId, topicName, mix) {
  await sequelize1.transaction(async (t) => {
    let meta = await TopicQuestionPoolMeta.findByPk(topic_uuid, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!meta) {
      meta = await TopicQuestionPoolMeta.create(
        {
          topic_uuid,
          pool_status: "seeding",
        },
        { transaction: t }
      );
    }

    if (meta.pool_status === "ready") {
      return;
    }

    // If already ready, we only check for refill
    const seededDims = meta.dimensions_seeded || {}; // Load existing seeded dimensions
    const updatedDims = { ...seededDims }; // Clone for update

    for (const [dimension, required] of Object.entries(mix)) {
      const count = Number(required);
      if (!Number.isFinite(count) || count <= 0) continue;

      // ✅ Skip already seeded dimension
      if (seededDims[dimension] === true) {
        console.log(`✅ [POOL] Skipping already seeded: ${dimension}`);
        continue;
      }

      const activeCount = await QuestionPool.count({
        where: {
          topic_uuid,
          dimension,
          usage_count: { [Op.lt]: MAX_USAGE },
        },
        transaction: t,
      });

      const target = count + BUFFER_PER_DIMENSION;
      const deficit = target - activeCount;
      if (deficit <= 0) {
        console.log(`✅ [POOL] ${dimension} already has sufficient questions`);
        updatedDims[dimension] = true;
        continue;
      }

      console.log(`🤖 [POOL] Generating ${deficit} questions for ${dimension}`);
      const questions = await generateQuestionsForDimension({
        topicName,
        topicId: topic_uuid,
        userId,
        dimension,
        count: deficit,
      });

      // let success = true;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const isBuffer = i >= required; // `required` = main question count, rest are buffer

        await QuestionPool.findOrCreate({
          where: {
            topic_uuid,
            dimension,
            "question.text": q.text,
          },
          defaults: {
            topic_uuid,
            dimension,
            question: { text: q.text, options: q.options },
            correct_answer: q.correct_answer,
            usage_count: 0,
            is_buffer: isBuffer, // ✅ SET HERE
          },
          transaction: t,
        });
      }

      if (questions.length < deficit) {
        console.warn(`⚠️ Partial generation for ${dimension}. Generated: ${questions.length}/${deficit}`);
        updatedDims[dimension] = false; // mark as unseeded
      } else {
        updatedDims[dimension] = true;
      }

    }
    await meta.update(
      {
        pool_status: "ready",
        last_seeded_at: new Date(),
        dimensions_seeded: updatedDims // <- dynamically
      },
      { transaction: t }
    );
  });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function validatePoolQuestion(pq) {
  if (!pq) return "❌ pq is null or undefined";

  const q = pq.question;
  console.log("type",typeof q, typeof pq);
  if (!q || typeof q !== "object") return "❌ pq.question is missing or not an object";

  if (!q.text || typeof q.text !== "string") return "❌ pq.text is missing or not a string";

  if (!q.options || typeof q.options !== "object") return "❌ pq.options is missing or not an object";

  const optionsKeys = Object.keys(q.options);
  if (optionsKeys.length !== 4) return `❌ pq.question.options has ${optionsKeys.length} options instead of 4`;

  if (!["A", "B", "C", "D"].includes(pq.correct_answer)) {
    return `❌ pq.correct_answer is invalid: ${pq.correct_answer}`;
  }

  if (!q.options[pq.correct_answer]) {
    return `❌ pq.correct_answer '${pq.correct_answer}' not found in options`;
  }

  return null; // ✅ No error
}



export const generateTest = async (req, res) => {

  const userId = req.user.id;
  const { topicId } = req.body;

  try {
    /* =======================
       STEP 0: LOAD CONTEXT
    ======================= */
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ success: false, message: "Invalid topic" });
    }

    const mix = topic.recommended_item_mix;

    const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
    const learnerTotal = Object.entries(mix)
      .filter(([k]) => k !== "teacher_score")
      .reduce((s, [, v]) => s + Number(v || 0), 0);

    if (learnerTotal !== LEARNER_TOTAL_REQUIRED || mix.teacher_score !== TEACHER_SCORE_REQUIRED) {
      throw new Error(
        `❌ Invalid mix: learner questions must sum to ${LEARNER_TOTAL_REQUIRED}, and teacher_score must be ${TEACHER_SCORE_REQUIRED}. Got learner=${learnerTotal}, teacher_score=${mix.teacher_score}`
      );
    }

    
    /* =======================
      STEP 1: BUILD TEST FROM QUESTION POOL
    ======================= */

    await ensureQuestionPool(topicId, userId, topic.name, mix);

    // const learnerProfile = await getUserLearningMetrics(userId);
    /* =======================
      STEP 2: BUILD TEST FROM POOL
    ======================= */
    let finalQuestions = [];
    let finalAnswers = [];
    let finalRubrics = [];

    
    await sequelize1.transaction(async (t) => {
      for (const [dimension, required] of Object.entries(mix)) {
        const count = Number(required);
        if (!Number.isFinite(count) || count <= 0) continue;

        let rawPool = await QuestionPool.findAll({
          where: {
            topic_uuid: topicId,
            dimension,
            usage_count: { [Op.lt]: 3 },
          },
          order: [["usage_count", "ASC"]], // still prefer low-used
          limit: 10, // fetch extra
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        // Shuffle in JS
        rawPool = shuffleArray(rawPool); // Use helper function
        const poolQuestions = rawPool.slice(0, required);

        if (poolQuestions.length < count) {
          console.warn(`⚠️ Pool shortage for ${dimension}. Attempting fallback...`);
          let topicName = topic.name;
          const fallbackQs = await generateQuestionsForDimension({
            topicId,
            topicName,
            userId,
            dimension,
            count,
          });

          const normalizedFallback = fallbackQs.map((q) => ({
            id: null, // not from DB
            question: {
              text: q.text,
              options: q.options
            },
            correct_answer: q.correct_answer,
            is_fallback: true
          }));

          poolQuestions.push(...normalizedFallback);
        }

        if (poolQuestions.length < count) {
          throw new Error(`Insufficient pool questions for ${dimension} even after fallback.`);
        }

        for (const pq of poolQuestions) {
          // const id = finalQuestions.length + 1;
    
          const error = validatePoolQuestion(pq);
          if (error) {
            console.warn(`⚠️ Malformed question (ID=${pq?.id || "N/A"}): ${error}`);
            console.dir(pq, { depth: null });
            continue;
          }

          if (!pq?.question?.text || !pq?.question?.options || Object.keys(pq?.question?.options).length !== 4 || !["A", "B", "C", "D"].includes(pq.correct_answer)) {
            throw new Error("Invalid question format");
          }

          finalQuestions.push({
            id: UUIDV4(),
            pool_qid: pq.id,
            dimension,
            text: pq.question.text,
            options: pq.question.options,
          });

    
          finalAnswers.push({ id: UUIDV4(), correct_answer: pq.correct_answer });
    
          finalRubrics.push({
            block_key: "baseline",
            global_qid: UUIDV4(),
            option_impacts: {
              [pq.correct_answer]: { [dimension]: 1 },
            },
            item_weight: 1,
          });
    
          if (pq.id && typeof pq.increment === "function") {
            await pq.increment("usage_count", { transaction: t });
          }
        }
      }
    });
    

    if (finalQuestions.length !== REQUIRED_TOTAL) {
      throw new Error(
        `Test generation failed: expected ${REQUIRED_TOTAL}, got ${finalQuestions.length}`
      );
    }

    /* =======================
       STEP 4: SAVE TEST
    ======================= */
    const payment = await findUnusedSuccessfulPayment(userId, topicId);
    
    const test = await Test.create({
      user_id: userId,
      topic_uuid: topicId,
      topic_name: topic.name,
      topics : [{
        id: topic.id,
        name: topic.name,
        description: topic.description,
        session_count: topic.session_count,
        prices: topic.prices,
      }],
      questions: finalQuestions,
      answers: finalAnswers,
      test_settings: {
        difficulty: "baseline",
        time_limit_minutes: DEFAULT_TIME_LIMIT_MINUTES,
        retest_wait: 5,
        fraud_risk_score: 0,
        cps_baseline: true,
      },
      payment_id: payment?.payment_id,
      status: "generated"
    });

    return res.status(200).json({
      success: true,
      data: {
        test_id: test.id,
        topicId,
        difficulty: "baseline",
        time_limit_minutes: DEFAULT_TIME_LIMIT_MINUTES,
      },
    });


  } catch (err) {
    console.error("❌ generateTest error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal error generating test",
    });
  }
};

export async function getReusableQuestions({
  topicId,
  excludeUserId,
  excludeCity,
  reuseLimit,
  mix,
  maxReuseCount = 3,
}) {
  const questionMap = new Map(); // key: questionText, value: { ...q, reuseCount, dimensions }

  const tests = await Test.findAll({
    where: {
      topic_uuid: topicId,
      user_id: { [Op.ne]: excludeUserId },
    },
    order: [['createdAt', 'DESC']],
    limit: 200, // limit scope for performance
  });

  const flagged = await TestFlag.findAll({
    attributes: ['question_id'],
    where: { reason: 'leaked' },
  });
  const flaggedQIDs = new Set(flagged.map(f => f.question_id));

  for (const test of tests) {
    const { questions = [], test_id, user_id } = test;

    const device = await UserDevice.findOne({ where: { userId: user_id } });
    const userCity = device?.city || null;

    if (userCity && excludeCity && userCity.toLowerCase() === excludeCity.toLowerCase()) {
      continue; // skip same city
    }

    const rubrics = await TestItemRubric.findAll({
      where: { test_id },
    });

    const rubricMap = new Map();
    rubrics.forEach(r => {
      const dim = extractDimensionFromRubric(r.option_impacts);
      rubricMap.set(r.global_qid, dim);
    });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const global_qid = q.id;
      if (flaggedQIDs.has(global_qid)) continue;

      const dimension = rubricMap.get(global_qid);
      const key = q.text;

      if (!dimension || !mix[dimension]) continue;

      if (!questionMap.has(key)) {
        questionMap.set(key, {
          question: q,
          correct_answer: null, // will be filled later if needed
          dimension,
          reuseCount: 1,
        });
      } else {
        const entry = questionMap.get(key);
        entry.reuseCount++;
        questionMap.set(key, entry);
      }
    }
  }

  const selected = [];
  const answers = [];
  const rubrics = [];
  const countPerDimension = Object.fromEntries(Object.keys(mix).map(dim => [dim, 0]));

  for (const { question, dimension, reuseCount } of questionMap.values()) {
    if (reuseCount > maxReuseCount) continue;

    if (countPerDimension[dimension] < mix[dimension]) {
      const global_qid = selected.length + 1;
      selected.push({ ...question, id: global_qid });
      answers.push({ id: global_qid, correct_answer: question.correct_answer });

      const impactTemplate = { A: {}, B: {}, C: {}, D: {} };
      if (["A", "B", "C", "D"].includes(question.correct_answer)) {
        impactTemplate[question.correct_answer] = { [dimension]: 1 };
      }

      rubrics.push({
        block_key: "baseline",
        global_qid,
        option_impacts: impactTemplate,
        gates: {},
        item_weight: 1.0,
      });

      countPerDimension[dimension]++;
      if (selected.length >= reuseLimit) break;
    }
  }

  return {
    questions: selected,
    answers,
    rubrics,
  };
}

function extractDimensionFromRubric(optionImpacts) {
  for (const opt of Object.values(optionImpacts)) {
    const dims = Object.keys(opt || {});
    if (dims.length > 0) return dims[0];
  }
  return null;
}

export function computeRemainingMix(fullMix, reusedRubrics) {
  const dimUsed = {};

  for (const row of reusedRubrics) {
    const dim = extractDimensionFromRubric(row.option_impacts);
    if (dim) dimUsed[dim] = (dimUsed[dim] || 0) + 1;
  }

  const result = {};
  for (const [dim, targetCount] of Object.entries(fullMix)) {
    const used = dimUsed[dim] || 0;
    result[dim] = Math.max(0, targetCount - used);
  }

  return result;
}



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

    const reviewData = questions.filter(q => q.dimension !== "teacher_score").map((q) => {
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
