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
import { PromoCode } from "../../Models/PromoCodeModels/PromoCode.Model.js";
import { PromoCodeRedemption } from "../../Models/PromoCodeModels/PromoCodeRedemption.Model.js";
import { transporter } from "../../config/mailer.js";
import NotificationService from "../../services/notificationService.js";
import { TeacherTopicQualification } from "../../Models/TeacherTopicQualification.model.js";

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
    let { topicId, paymentMode, promoCode } = req.body;
    console.log("💰 initiateTestPayment called with:", { topicId, paymentMode, promoCode });

    paymentMode = paymentMode === "LIVE" ? "LIVE" : "DEMO";
    const userId = req.user.id;

    if (!topicId) {
      return res.status(400).json({ success: false, message: "Topic ID is required" });
    }

    // Check for existing payment
    const existingPayment = await checkTestPayment(userId, topicId);
    if (existingPayment) {
      return res.status(400).json({ success: false, message: "Payment already completed for this test" });
    }

    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ success: false, message: "Invalid topic" });
    }

    const originalAmount = Math.round(topic.topic_price * 100); // ₹ → paise
    let discountAmount = 0;
    let finalPrice = originalAmount;

    // ✅ Validate promo code if provided
    if (promoCode) {
      const promo = await PromoCode.findByPk(promoCode);

      if (!promo || !promo.is_active)
        return res.status(404).json({ success: false, message: "Invalid promo code" });

      if (promo.expires_at && new Date() > promo.expires_at)
        return res.status(410).json({ success: false, message: "Promo code expired" });

      if (promo.used_count >= promo.usage_limit)
        return res.status(429).json({ success: false, message: "Promo usage limit reached" });

      if (promo.user_id && promo.user_id !== userId)
        return res.status(403).json({ success: false, message: "Promo not assigned to this user" });

      const alreadyUsed = await PromoCodeRedemption.findOne({ where: { promo_code: promoCode, user_id: userId } });
      if (alreadyUsed)
        return res.status(409).json({ success: false, message: "Promocode already used by user" });

      if (promo.min_order_value && originalAmount < promo.min_order_value)
        return res.status(400).json({ success: false, message: "Order value too low for this promo" });

      // Apply discount (SAFE VERSION)
      if (promo.type === "percentage") {
        const percentage = Math.min(Math.max(promo.discount, 0), 100); // cap 0–100%
        const rawDiscount = (percentage / 100) * originalAmount; // paise
        discountAmount = Math.min(Math.ceil(rawDiscount), originalAmount); // cap to price
      } 
      else if (promo.type === "amount") {
        discountAmount = Math.min(Math.ceil(promo.discount * 100), originalAmount); // ₹ → paise, cap to price
      }

      // Final price calculation
      finalPrice = originalAmount - discountAmount;

      // Razorpay minimum ₹1 safeguard
      if (finalPrice < 100) finalPrice = 100; // 100 paise = ₹1

      console.log(`✅ Promo ${promoCode} applied. Discount: ₹${(discountAmount / 100).toFixed(2)}. Final amount: ₹${(finalPrice / 100).toFixed(2)}`);
    }

    const currency = "INR";
    const receipt = generateReceiptId(topicId, userId);
    const razorpay = getRazorpayInstance(paymentMode);

    const order = await razorpay.orders.create({
      amount:finalPrice,
      currency,
      receipt,
      notes: {
        user_id: userId,
        topic_id: topicId,
        topic_name: topic.name,
        promo_code: promoCode || null,
        discount_applied: discountAmount,
        payment_mode: paymentMode,
      },
    });

    const payment = await Payment.create({
      user_id: userId,
      entity_type: "test",
      entity_id: topicId,
      order_id: order.id,
      amount: finalPrice,
      currency,
      status: "created",
      payment_mode: paymentMode,
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        key: paymentMode === "LIVE" ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_KEY_ID,
        order_id: order.id,
        amount: finalPrice,
        currency,
        topic_name: topic.name,
        payment_id: payment.payment_id,
        promo_code: promoCode || null,
        discount_applied: discountAmount,
        original_amount: originalAmount,
      },
    });
  } catch (error) {
    console.error("❌ Error initiating test payment:", error);
    return res.status(500).json({ success: false, message: "Failed to initiate payment", error: error.message });
  }
};

export const verifyTestPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, topicId,promo_code } = req.body;

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

    // ✅ Start DB transaction
    await sequelize1.transaction(async (t) => {
      // Step 1: Update payment
      payment.razorpay_payment_id = razorpay_payment_id;
      payment.razorpay_signature = razorpay_signature;
      payment.status = "success";
      await payment.save({ transaction: t });

      // Step 2: Handle promo redemption
      if (promo_code) {
        const promo = await PromoCode.findOne({
          where: { code: promo_code },
          transaction: t,
          lock: t.LOCK.UPDATE, // row-level lock
        });

        if (!promo) {
          throw new Error("Promo code not found");
        }

        // Check redemption (enforced at DB too)
        const alreadyRedeemed = await PromoCodeRedemption.findOne({
          where: {
            promo_code: promo.code,
            user_id: userId,
          },
          transaction: t,
        });

        if (!alreadyRedeemed) {
          await PromoCodeRedemption.create(
            {
              promo_code: promo.code,
              user_id: userId,
            },
            { transaction: t }
          );

          promo.used_count += 1;
          await promo.save({ transaction: t });
        }
      }
    });

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


    //original
    // const passed = percentage >= 90;

    // Pilot case
    const passed = percentage >= 75;

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


    /* ------------------ 4) Original Cooling period ------------------ */
    // let cooling_period_days = 0;
    // if (percentage >= 80 && percentage < 90) cooling_period_days = 7;
    // else if (percentage < 80) cooling_period_days = 14;

    // test.cooling_period = cooling_period_days;
    // let cooling_period_end = null;
    // if (cooling_period_days > 0) {
    //   const submittedAt = test.submitted_at ? new Date(test.submitted_at) : new Date();
    //   cooling_period_end = new Date(submittedAt.getTime() + cooling_period_days * 86400000);
    // }

    //------------------ 4) TEST PILOT --------------------------- */
    let cooling_period_days = 0;
    if (percentage >= 60 && percentage < 75) cooling_period_days = 7;
    else if (percentage < 60) cooling_period_days = 14;

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

      // ✅ Create or update TeacherTopicQualification (JOIN TABLE)
      await TeacherTopicQualification.upsert({
        teacher_id: test.user_id,
        topic_id: test.topic_uuid,
        exam_score: percentage,
        passed: true,
        passed_at: new Date(),
        certification_level:"Bridger"
      });

    }

    await test.save();

    try {
      const user = await User.findByPk(test.user_id, {
        attributes: ["email", "firstName"],
      });

      if (user?.email) {
        await sendTestResultEmail({
          to: user.email,
          name: user.firstName,
          testName: test.title || "TOTLE Assessment Result",
          percentage,
          passed: gatedPass,
          coolingPeriodDays: test.cooling_period || 0,
        });
      }
    } catch (mailErr) {
      console.error("⚠️ Failed to send result email:", mailErr.message);
    }

    /* ------------------ 10) Create In-App Notification ------------------ */
try {
  const isPass = gatedPass;

  const title = isPass
    ? "🎉 Test Passed!"
    : "📊 Test Result Available";

  const message = isPass
    ? `Congratulations! You passed your test with ${percentage}%.`
    : `Your test has been evaluated. Score: ${percentage}%. Please review and retry after the cooling period.`;

    await NotificationService.createTestNotification(test.user_id, {
      title: gatedPass ? "🎉 Test Passed!" : "📊 Test Result",
      message: gatedPass
        ? `Congratulations! You passed with ${percentage}%.`
        : `You scored ${percentage}%. Please retry after cooling period.`,
      priority: gatedPass ? "medium" : "high",
      data: {
        test_id: test.test_id,
        percentage,
        result: gatedPass ? "Pass" : "Fail",
        cooling_period_days: test.cooling_period,
        action: {
          callback: `/learn/tests/${test.test_id}`,
        },
      },
    });


  } catch (notifErr) {
    console.error("⚠️ Notification creation failed:", notifErr.message);
  }


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

export const sendTestResultEmail = async ({
  to,
  name,
  testName,
  percentage,
  passed,
  coolingPeriodDays,
}) => {
  const subject = passed
    ? "🎉 Congratulations! You Passed Your Test"
    : "📊 Test Evaluation Result";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Hello ${name},</h2>
      <p>Your test <strong>${testName}</strong> has been evaluated.</p>

      <table style="border-collapse: collapse;">
        <tr>
          <td><strong>Score</strong></td>
          <td style="padding-left:10px;">${percentage}%</td>
        </tr>
        <tr>
          <td><strong>Result</strong></td>
          <td style="padding-left:10px; color:${passed ? "green" : "red"};">
            ${passed ? "Pass ✅" : "Fail ❌"}
          </td>
        </tr>
        ${
          !passed && coolingPeriodDays > 0
            ? `<tr>
                <td><strong>Cooling Period</strong></td>
                <td style="padding-left:10px;">${coolingPeriodDays} days</td>
              </tr>`
            : ""
        }
      </table>

      <p>
        ${
          passed
            ? "You are now eligible to proceed further on the platform."
            : "You may retake the test after the cooling period."
        }
      </p>

      <p>Best of luck,<br/><strong>The TOTLE Team</strong></p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Assessment Result" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    html,
  });
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

  const submitted = !!test.submitted_at;
  const cooldownDays = test.cooling_period ?? 0;
  const cooldownEnd = submitted ? new Date(test.submitted_at) : null;

  let formattedCooldownEnd = null;

  if (cooldownEnd) {
    // add cooldown days
    cooldownEnd.setDate(cooldownEnd.getDate() + cooldownDays);

    // format: 24 - Jan - 2026 - 03:45 PM
    formattedCooldownEnd = cooldownEnd.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", "") // remove comma between date and time
    .replace(/(\d{2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}) (AM|PM)/i, (_, dd, mmm, yyyy, hh, mm, ampm) => {
      return `${dd} - ${mmm} - ${yyyy}, ${hh}:${mm} ${ampm.toLowerCase()}`;
    });
  }

  // ❌ If test was submitted and cooldown is still active
  if (submitted && cooldownEnd && new Date() < cooldownEnd) {
    return res.status(403).json({
      success: false,
      test_status: "submitted",
      submitted: true,
      message: `Cooling period active. You can retake this test after ${formattedCooldownEnd}`,
      cooling_period_end: cooldownEnd.toISOString(),     // machine readable
      cooling_period_formatted: formattedCooldownEnd,    // UI readable
    });
  }


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


export const generateTest = async (req, res) => {
  const BASELINE_QUESTION_COUNT = 25;
  const REUSE_RATIO = 0.7;
  const MAX_REUSE_PER_QUESTION = 3;
  const DEFAULT_TIME_LIMIT_MINUTES = 30;

  const userId = req?.user?.id;
  const { topicId } = req.body;

  if (!userId || !topicId) {
    return res.status(400).json({ success: false, message: "Missing userId or topicId." });
  }

  try {
    const [user, userDevice] = await Promise.all([
      User.findByPk(userId),
      UserDevice.findOne({ where: { userId } }),
    ]);
    const currentCity = userDevice?.city || user?.location || null;

    // ✅ Fetch topic/domain
    const { subject, domain } = await findSubjectAndDomain(topicId);
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ success: false, message: "Invalid topic." });
    }

    const mix = topic?.recommended_item_mix || {};
    const learnerProfile = await getUserLearningMetrics(userId);
    const reuseLimit = Math.floor(BASELINE_QUESTION_COUNT * REUSE_RATIO);

    // ✅ Step 1: Collect Reusable Questions (excluding same city)
    const reusedPool = await getReusableQuestions({
      topicId,
      excludeUserId: userId,
      excludeCity: currentCity,
      reuseLimit,
      mix,
      maxReuseCount: MAX_REUSE_PER_QUESTION,
    });

    const reusedQuestions = reusedPool.questions;
    const reusedAnswers = reusedPool.answers;
    const reusedRubrics = reusedPool.rubrics;

    const remainingCount = BASELINE_QUESTION_COUNT - reusedQuestions.length;
    let freshQuestions = [];
    let freshAnswers = [];
    let freshRubrics = [];

    // ✅ Step 2: Generate remaining questions (AI fallback)
    if (remainingCount > 0) {
      const freshPerDimension = computeRemainingMix(mix, reusedRubrics);

      for (const [dimension, count] of Object.entries(freshPerDimension)) {
        if (count <= 0) continue;

        const result = await generateQuestions({
          subject: subject?.name,
          subjectDescription: subject?.description,
          domain: domain?.name,
          domainDescription: domain?.description,
          topicName: topic?.name,
          topicDescription: topic?.description,
          learnerProfile,
          topicParams: {
            ...(topic?.computed_cps_weights || {}),
            ...(topic?.recommended_item_mix || {}),
            ...(topic?.recommended_time_pressure ? { recommended_time_pressure: topic.recommended_time_pressure } : {}),
            ...(topic?.metadata || {}),
            dimension_focus: dimension,
          },
          subtopics: [],
          topicId,
          userId,
          count,
        });

        const freshGlobalIds = freshQuestions.length;
        for (let i = 0; i < result.questions.length; i++) {
          const q = result.questions[i];
          const a = result.answers.find(ans => ans.id === q.id)?.correct_answer;

          const global_qid = freshGlobalIds + i + 1;
          freshQuestions.push({ id: global_qid, text: q.text, options: q.options });
          freshAnswers.push({ id: global_qid, correct_answer: a });

          const impactTemplate = { A: {}, B: {}, C: {}, D: {} };
          if (["A", "B", "C", "D"].includes(a)) {
            impactTemplate[a] = { [dimension]: 1 };
          }

          freshRubrics.push({
            block_key: "baseline",
            global_qid,
            option_impacts: impactTemplate,
            gates: {},
            item_weight: 1.0,
          });
        }
      }
    }

    const flatQuestions = dedupeById(
      [...reusedQuestions, ...freshQuestions],
      { idKey: "id" }
    ).slice(0, BASELINE_QUESTION_COUNT);

    const flatAnswers = dedupeById(
      [...reusedAnswers, ...freshAnswers],
      {
        idKey: "id",
        allowUndefined: false,
        allowNull: false }).slice(0, BASELINE_QUESTION_COUNT);

    const rubricRows = dedupeById([...reusedRubrics, ...freshRubrics], { idKey: "global_qid" }).slice(0, BASELINE_QUESTION_COUNT);

    console.log("flat answers (DEDUPED)", flatAnswers);


    // ✅ Final Save
    const payment = await findUnusedSuccessfulPayment(userId, topicId);
    const count = (await Test.count()) + 1;

    const savedTest = await Test.create({
      sl_no: count,
      topic_name: topic.name,
      user_id: userId,
      topic_uuid: topicId,
      difficulty: "baseline",
      topics: [{
        id: topic.id,
        name: topic.name,
        description: topic.description,
        session_count: topic.session_count,
        prices: topic.prices,
      }],
      questions: flatQuestions,
      answers: flatAnswers,
      test_settings: {
        difficulty: "baseline",
        time_limit_minutes: DEFAULT_TIME_LIMIT_MINUTES,
        retest_wait: 5,
        fraud_risk_score: 0,
        cps_baseline: true,
      },
      status: "generated",
      payment_id: payment.payment_id,
    });

    // Deduplicate rubric rows by global_qid
    const uniqueRubrics = [];
    const seenQids = new Set();

    for (const row of rubricRows) {
      if (!seenQids.has(row.global_qid)) {
        seenQids.add(row.global_qid);
        uniqueRubrics.push(row);
      } else {
        console.warn(`⚠️ Duplicate global_qid detected: ${row.global_qid}. Skipping.`);
      }
    }


    // ✅ Save Rubrics
    // await TestItemRubric.bulkCreate(
    //   rubricRows.map(row => ({
    //     test_id: savedTest.test_id,
    //     block_key: row.block_key,
    //     global_qid: row.global_qid,
    //     option_impacts: row.option_impacts,
    //     gates: row.gates,
    //     item_weight: row.item_weight ?? 1,
    //   })),
    //   { validate: true }
    // );

    return res.status(200).json({
      success: true,
      message: "Test generated with secure reuse strategy.",
      data: {
        test_id: savedTest.test_id,
        topicId,
        difficulty: "baseline",
        time_limit_minutes: DEFAULT_TIME_LIMIT_MINUTES,
        questions: flatQuestions,
      },
    });

  } catch (err) {
    console.error("❌ generateTest error:", err);
    return res.status(500).json({ success: false, message: "Internal error generating test." });
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
