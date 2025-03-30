// File: src/routes/testGenerator.routes.js

import express from "express";
import { generateTest } from "../controllers/testGenerator.controller.js";

const router = express.Router();

/**
 * @route   POST /api/tests/generate
 * @desc    Generate a test for a user based on topic and learner profile
 * @access  Public (secured with auth later)
 */
router.post("/generate", generateTest);
// Route: Evaluate a submitted test by test_id
router.post("/:test_id/evaluate", evaluateTest);

export default router;
