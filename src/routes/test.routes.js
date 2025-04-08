import express from "express";
import {
  generateTest,
  startTest,
  submitTest,
  evaluateTest,
  checkRetestEligibility,
  getUserTestHistory,
  getTestById, // ✅ import it here
} from "../controllers/TestGeneratorControllers/testGenerator.controller.js";

const router = express.Router();

router.post("/generate", generateTest);
router.post("/start/:test_id", startTest);
router.post("/submit/:test_id", submitTest);
router.post("/evaluate/:test_id", evaluateTest);
router.get("/retest-eligibility/:userId/:topicId", checkRetestEligibility);
router.get("/user/:userId", getUserTestHistory); // ✅ Add this line
router.get("/:testId", getTestById);

export default router;
