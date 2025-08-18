import express from "express";
import {
  generateTest,
  startTest,
  submitTest,
  evaluateTest,
  checkRetestEligibility,
  getUserTestHistory,
  getTestById,
  getQualifiedTopics,
  getTeachStats,
  getAnswersByTopic,
  logCheatEvent,
  getCheatLogs,
  getTestReview,
  reportTest,
  // Add these new payment-related functions
  initiateTestPayment,
  verifyTestPayment,
  checkTestPaymentStatus,
} from "../controllers/TestGeneratorControllers/testGenerator.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ NEW: Payment routes for tests
router.post("/payment/initiate", authMiddleware, initiateTestPayment);
router.post("/payment/verify", authMiddleware, verifyTestPayment);
router.get("/payment/status/:topicId", authMiddleware, checkTestPaymentStatus);

// ✅ UPDATED: Add authMiddleware to generateTest since it now requires payment
router.post("/generate", authMiddleware, generateTest);
router.post("/start/:test_id", authMiddleware, startTest);
router.post("/submit/:test_id", authMiddleware, submitTest);
router.post("/evaluate/:test_id", authMiddleware, evaluateTest);

router.get("/retest-eligibility/:id", authMiddleware, checkRetestEligibility);
router.get("/user/:userId", getUserTestHistory);
router.get("/qualified-topics", getQualifiedTopics);
router.get("/stats", getTeachStats);
router.post("/cheat", authMiddleware, logCheatEvent);
router.get("/detail", authMiddleware, getCheatLogs);
router.post("/report", authMiddleware, reportTest);
router.get('/:testId/review', authMiddleware, getTestReview);

//Todo: Only for the development purpose
router.get("/answers/:topicId", getAnswersByTopic);
router.get("/:testId", getTestById);

export default router;