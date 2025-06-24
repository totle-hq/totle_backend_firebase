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
  getAnswersByTopic, // ✅ import it here
} from "../controllers/TestGeneratorControllers/testGenerator.controller.js";

const router = express.Router();

router.post("/generate", generateTest);
router.post("/start/:test_id", startTest);
router.post("/submit/:test_id", submitTest);
router.post("/evaluate/:test_id", evaluateTest);
router.get("/checkRetestEligibility", checkRetestEligibility); // ✅ Matches frontend query params
router.get("/user/:userId", getUserTestHistory); // ✅ Add this line
router.get("/qualified-topics", getQualifiedTopics);
router.get("/stats", getTeachStats);
//Todo: Only for the development purpose
router.get("/answers/:topicId", getAnswersByTopic);
router.get("/:testId", getTestById);

export default router;
