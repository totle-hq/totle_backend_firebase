// File: src/services/testStorage.service.js

import { Test } from "../Models/test.model.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Saves a generated test to the database for persistence.
 * This is triggered once the test is generated (before starting).
 * @param {Object} testData - Object containing userId, topicId, difficulty, questions
 * @returns {Promise<Test>}
 */
export const saveTest = async (testData) => {
  try {
    // Validate required fields
    const { userId, topicId, difficulty, questions } = testData;
    if (!userId || !topicId || !Array.isArray(questions)) {
      throw new Error("Missing required fields for saving test.");
    }

    // Create new Test entry
    const test = await Test.create({
      test_id: uuidv4(), // manually set UUID
      user_id: userId,
      topic_id: topicId,
      difficulty,
      questions,
      status: "generated",
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log("✅ Test saved to DB:", test.test_id);
    return test;
  } catch (error) {
    console.error("❌ Failed to save test to DB:", error);
    throw new Error("Database error: Failed to save test.");
  }
};
