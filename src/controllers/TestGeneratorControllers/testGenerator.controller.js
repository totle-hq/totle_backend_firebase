// File: src/controllers/TestGeneratorControllers/testGenerator.controller.js

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
import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { TabSwitchEvent } from "../../Models/TabswitchModel.js";
import { TestFlag } from "../../Models/TestflagModel.js";
import { findSubjectAndDomain } from "../../utils/getsubject.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { Payment } from "../../Models/PaymentModels.js";

/**
 * POST /api/tests/generate
 * Request Body: { userId: string, topicId: string }
 */


// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ NEW: Check if user has paid for a test
const checkTestPayment = async (userId, topicId) => {
  const payment = await Payment.findOne({
    where: {
      user_id: userId,
      entity_type: 'test',
      entity_id: topicId,
      status: 'success'
    }
  });
  return !!payment;
};
const generateReceiptId = (topicId, userId) => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits
  const topicShort = topicId.slice(-8); // Last 8 chars of topic ID
  const userShort = userId.slice(-8); // Last 8 chars of user ID
  return `t_${topicShort}_${userShort}_${timestamp}`.slice(0, 40);
};
// ✅ NEW: Initiate payment for test
export const initiateTestPayment = async (req, res) => {
  try {
    const { topicId } = req.body;
    const userId = req.user.id;

    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        message: "Topic ID is required" 
      });
    }

    // Check if user already has a successful payment for this test
    const existingPayment = await checkTestPayment(userId, topicId);
    if (existingPayment) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment already completed for this test" 
      });
    }

    // Verify topic exists
    const topic = await CatalogueNode.findByPk(topicId);
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid topic" 
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
        entity_type: 'test'
      }
    });

    // Save payment record
    const payment = await Payment.create({
      user_id: userId,
      entity_type: 'test',
      entity_id: topicId,
      order_id: order.id,
      amount,
      currency,
      status: 'created'
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
      }
    });

  } catch (error) {
    console.error("❌ Error initiating test payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message
    });
  }
};

export const verifyTestPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      topicId
    } = req.body;

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
        message: "Invalid payment signature"
      });
    }

    // Update payment record
    const payment = await Payment.findOne({
      where: {
        user_id: userId,
        entity_type: 'test',
        entity_id: topicId,
        order_id: razorpay_order_id
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    payment.razorpay_payment_id = razorpay_payment_id;
    payment.razorpay_signature = razorpay_signature;
    payment.status = 'success';
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        payment_id: payment.payment_id,
        status: 'success'
      }
    });

  } catch (error) {
    console.error("❌ Error verifying test payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message
    });
  }
};



export const checkTestPaymentStatus = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    const hasValidPayment = await checkTestPayment(userId, topicId);

    return res.status(200).json({
      success: true,
      data: {
        paid: hasValidPayment,
        amount_required: hasValidPayment ? 0 : 9900
      }
    });

  } catch (error) {
    console.error("❌ Error checking payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message
    });
  }
};

// ✅ generateTest with ID mapping fixed
// ✅ UPDATED: Modified generateTest with payment verification
export const generateTest = async (req, res) => {
  try {
    const { topicId } = req.body;
    const userId = req.user.id; // Now using req.user from authMiddleware
    
    if (!userId || !topicId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing userId or topicId." 
      });
    }

    // ✅ NEW: Check payment before generating test
    const hasValidPayment = await checkTestPayment(userId, topicId);
    if (!hasValidPayment) {
      return res.status(402).json({
        success: false,
        message: "Payment required to take this test. Please pay ₹99 to continue.",
        payment_required: true,
        amount: 9900 // in paise
      });
    }

    // Get subject and domain info
    const { subject, domain } = await findSubjectAndDomain(topicId);
    const subjectName = subject?.name || "";
    const subjectDescription = subject?.description || "";
    const domainName = domain?.name || "";
    const domainDescription = domain?.description || "";

    console.log(subject, domain);

    const topic = await CatalogueNode.findByPk(topicId);
    
    if (!topic || !topic.is_topic) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid topic." 
      });
    }

    const topicDescription = topic.description || "";
    const topicParams = topic.metadata || {};

    const learnerProfile = await getUserLearningMetrics(userId);
    const difficulty = "beginner";
    const seenTexts = new Set();
    let finalQuestions = [];
    let finalAnswers = [];
    let attempts = 0;

    console.log("details", topic.name, topicDescription, subjectName, subjectDescription, domainName, domainDescription, topicParams);

    while (finalQuestions.length < 20 && attempts < 5) {
      const { questions, answers } = await generateQuestions({
        subject: subjectName,
        subjectDescription,
        domain: domainName,
        domainDescription,
        learnerProfile,
        topicName: topic.name,
        topicDescription,
        topicParams,
        topicId,
        userId,
        count: 20,
      });

      for (let i = 0; i < questions.length && finalQuestions.length < 20; i++) {
        const q = questions[i];
        const ans = answers.find(a => a.id === q.id);

        if (!seenTexts.has(q.text) && ans) {
          seenTexts.add(q.text);
          const newId = finalQuestions.length + 1;

          finalQuestions.push({ id: newId, text: q.text, options: q.options });
          finalAnswers.push({ id: newId, correct_answer: ans.correct_answer });
        }
      }

      attempts++;
    }

    if (finalQuestions.length !== 20) {
      return res.status(500).json({
        success: false,
        message: "Could not generate enough unique questions.",
      });
    }

    const time_limit_minutes = 30;
    const count = await Test.count() + 1;

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
      questions: finalQuestions,
      answers: finalAnswers,
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
        questions: finalQuestions,
      },
    });
  } catch (error) {
    console.error("❌ Error generating test:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate test.",
      error: error.message,
    });
  }
};




// ✅ Start a Test
export const startTest = async (req, res) => {
  try {
    const { test_id } = req.params;
    const userId = req.user.id;

    const test = await Test.findByPk(test_id);
    if (!test) {
      return res.status(404).json({ 
        success: false, 
        message: "Test not found" 
      });
    }

    // Verify the test belongs to the user
    if (test.user_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    // Double-check payment status
    const hasValidPayment = await checkTestPayment(userId, test.topic_uuid);
    if (!hasValidPayment) {
      return res.status(402).json({
        success: false,
        message: "Payment required to start this test",
        payment_required: true
      });
    }

    if (test.status !== "generated") {
      return res.status(400).json({ 
        success: false, 
        message: "Test cannot be started in its current state" 
      });
    }

    test.status = "started";
    test.started_at = new Date();
    await test.save();

    return res.status(200).json({ 
      success: true, 
      message: "Test started", 
      data: test 
    });
  } catch (error) {
    console.error("❌ Error starting test:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to start test", 
      error: error.message 
    });
  }
};

// ✅ Submit a test (status → "submitted")
export const submitTest = async (req, res) => {
  try {
    const { test_id } = req.params;
    const submittedAnswers = req.body.answers || {};
    const question_timings=req.body.timing||{}
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
    test.question_timings=question_timings;

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
    let cooling_period = 0; // default 0 weeks
    if (percentage >= 80 && percentage < 90) {
      cooling_period = 1;
    } else if(percentage < 80) {
      cooling_period = 7;
    }
    
    test.cooling_period = cooling_period;


    // ✅ If passed, add this topic to qualified topics
    if (passed) {
      test.eligible_for_bridger = true;
    
      const topicId = test.topic_uuid;
      const topic = await CatalogueNode.findByPk(topicId);

  const teacherId = test.user_id;

  const statExists = await Teachertopicstats.findOne({
    where: { teacherId, node_id:topicId }
  });

  if (!statExists) {
    await Teachertopicstats.create({
      teacherId,
      node_id:topicId,
      tier: 'Bridger',
      sessionCount: 0,
      rating: 0
    });
    console.log("Created Teachertopicstats for teacher");
  }

      if (topic) {
        const currentTeacherIds = Array.isArray(topic.qualified_teacher_ids) ? topic.qualified_teacher_ids : [];
        const currentTeacherNames = Array.isArray(topic.qualified_teacher_names) ? topic.qualified_teacher_names : [];
    
        if (!currentTeacherIds.includes(test.user_id)) {
          console.log(" Adding user to qualified_teachers:", test.user_id);

          const user = await User.findByPk(test.user_id, { attributes: ["id", "firstName"] });
          if (user) {

          const updatedTeacherIds = [...currentTeacherIds, test.user_id];
          const updatedNames = [...currentTeacherNames, user.firstName ];

          topic.set('qualified_teacher_ids', updatedTeacherIds);
          topic.set('qualified_teacher_names', updatedNames);
          await topic.save();

          const updatedTopic = await CatalogueNode.findByPk(topicId);
          // console.log("✅ Updated qualified_teachers:", updatedTopic.qualified_teacher_ids);
          // console.log("✅ Updated qualified_teacher_names:", updatedTopic.qualified_teacher_names);
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
    const {  topicId } = req.params.id;
const userId=req.user.id;
console.log(topicId,userId);
    if (!userId ) {
      return res.status(400).json({ success: false, message: "Missing userId " });
    }
    if(!topicId){
       return res.status(400).json({ success: false, message: "Missing topicId" });
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
      const  topicId = req.params.id;
  const userId=req.user.id;
  console.log(userId,topicId)
      if (!userId || !topicId) {
        return res.status(400).json({ success: false, message: "Missing userId or topicId" });
      }
  
      const {eligible ,waitTime,waitTimeInMinutes} = await isUserEligibleForRetest(userId, topicId);
  
      return res.status(200).json({
        success: true,
        eligible,
        waitTime,
        message: eligible
          ? "User is eligible to retake the test."
      
          : `User is currently on cooldown. Retest not allowed yet. try in ${waitTime.days}d: ${waitTime.hours}h :${waitTime.minutes}m : ${waitTime.seconds}s`,
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
    console.log('get Qualified Topics called');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing or invalid token format" });
    }
    const token = req.headers.authorization?.split(" ")[1];
    console.log('token', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('decoded', decoded);
    const userId = decoded.id;

    const topics =  await Teachertopicstats.findAll({
      where: { teacherId:userId },
      include: [
              {
                model: CatalogueNode,
                // as: "Topic",
                attributes: ['node_id', 'name',"parent_id"]
              },
      
      ]
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
// to post the cheat detail like:reload or switch the ta on the time of test
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
//
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
    const questionExists = test.questions?.some(
      (q) => q.id === questionId
    );

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

    const questions = test.questions || [];
    const submittedAnswers = test.answers_submitted || {};
    const correctAnswersArray = test.answers || [];

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
        selected_option: submitted || null,
        correct_answer: correct || null,
        is_correct: submitted === correct,
      };
    });

    return res.status(200).json({
      success: true,
      data: reviewData,
    });
  } catch (err) {
    console.error("❌ Error in test review:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


