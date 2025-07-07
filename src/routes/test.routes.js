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
  // ✅ import it here
} from "../controllers/TestGeneratorControllers/testGenerator.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/generate", generateTest);
router.post("/start/:test_id", startTest);
router.post("/submit/:test_id", submitTest);
router.post("/evaluate/:test_id", evaluateTest);
router.get("/retest-eligibility/:id",authMiddleware, checkRetestEligibility);
router.get("/user/:userId", getUserTestHistory); // ✅ Add this line
router.get("/qualified-topics", getQualifiedTopics);
router.get("/stats", getTeachStats);
router.post("/cheat", authMiddleware, logCheatEvent);
router.get("/detail",authMiddleware,getCheatLogs);
router.post("/report",authMiddleware,reportTest);
router.get('/:testId/review', authMiddleware, getTestReview);
//Todo: Only for the development purpose
router.get("/answers/:topicId", getAnswersByTopic);
router.get("/:testId", getTestById);

export default router;
