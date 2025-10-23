// File: src/routes/test.routes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
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
  initiateTestPayment,
  verifyTestPayment,
  checkTestPaymentStatus,
} from "../controllers/TestGeneratorControllers/testGenerator.controller.js";

// ✅ Live progress (SSE) helpers
import {
  attachSseClient,
  verifyTokenFromQuery,
} from "../utils/progressBus.js";

const router = express.Router();

/* -------------------- Payments -------------------- */
router.post("/payment/initiate", authMiddleware, initiateTestPayment);
router.post("/payment/verify", authMiddleware, verifyTestPayment);
router.get("/payment/status/:topicId", authMiddleware, checkTestPaymentStatus);

/* -------------------- Generation / Lifecycle -------------------- */
router.post("/generate", authMiddleware, generateTest);
router.post("/start/:test_id", authMiddleware, startTest);
router.post("/submit/:test_id", authMiddleware, submitTest);
router.post("/evaluate/:test_id", authMiddleware, evaluateTest);

/* -------------------- Retest & History -------------------- */
router.get("/retest-eligibility/:id", authMiddleware, checkRetestEligibility);
router.get("/user/:userId", getUserTestHistory);

/* -------------------- Teaching & Stats -------------------- */
router.get("/qualified-topics", authMiddleware, getQualifiedTopics);
router.get("/stats", getTeachStats);

/* -------------------- Integrity / Reports -------------------- */
router.post("/cheat", authMiddleware, logCheatEvent);
router.get("/detail", authMiddleware, getCheatLogs);
router.post("/report", authMiddleware, reportTest);

/* -------------------- Reviews -------------------- */
router.get("/:testId/review", authMiddleware, getTestReview);

/* -------------------- (Dev-only) Answers -------------------- */
router.get("/answers/:topicId", getAnswersByTopic);

/* -------------------- Live Progress Stream (SSE) -------------------- */
/**
 * Connect with:
 *   GET /api/tests/progress/stream?topicId=<TOPIC_ID>&token=<JWT>
 * or send JWT via Authorization: Bearer <JWT>
 */
router.get("/progress/stream", (req, res) => {
  const topicId = req.query.topicId;
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;
  const token = req.query.token || bearer;
  const userId = verifyTokenFromQuery(token);

  if (!userId || !topicId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing userId or topicId" });
  }

  attachSseClient({ req, res, userId, topicId });
});

/* -------------------- Fetch Test by ID (keep last) -------------------- */
router.get("/:testId", getTestById);

export default router;
