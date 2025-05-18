// File: src/controllers/test.controller.js

import { TestGeneratorService } from "../services/testGenerator.service.js";

/**
 * @desc API Controller to generate a test based on topic and learner profile
 * @route POST /api/tests/generate
 */
export const generateTestController = async (req, res) => {
  try {
    const { topicId, learnerProfile } = req.body;

    // Validate input
    if (!topicId || typeof learnerProfile !== "object") {
      return res.status(400).json({ success: false, message: "Invalid request. 'topicId' and 'learnerProfile' are required." });
    }

    // Delegate to service
    const test = await TestGeneratorService.generateTest(topicId, learnerProfile);

    return res.status(200).json({ success: true, data: test });
  } catch (error) {
    console.error("❌ Test generation error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during test generation." });
  }
};

