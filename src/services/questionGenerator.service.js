// File: src/services/questionGenerator.service.js

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

import { Test } from "../Models/test.model.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates unique test questions dynamically via OpenAI
 * Ensures previously generated questions for this user/topic aren't repeated
 *
 * @param {Object} params - Generation parameters
 * @param {Object} params.learnerProfile - User metrics
 * @param {Object} params.topicParams - Topic characteristics
 * @param {string} params.topicId - UUID of the topic
 * @param {number} params.count - Number of questions
 * @param {string} params.userId - UUID of the user
 * @returns {Promise<Array>} - Generated question objects
 */
export async function generateQuestions({
  learnerProfile,
  topicParams,
  topicId,
  count = 10,
  userId,
}) {
  try {
    const prompt = buildPrompt({ learnerProfile, topicParams, count });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const raw = response.choices?.[0]?.message?.content || "[]";
    let generatedQuestions = JSON.parse(raw);

    // ✅ Prevent duplicate questions: filter out previously used ones
    const previousTests = await Test.findAll({
      where: { topic_id: topicId, user_id: userId },
      attributes: ["questions"],
    });

    const previouslyAsked = new Set(
      previousTests.flatMap((t) => t.questions.map((q) => q.question_text))
    );

    generatedQuestions = generatedQuestions.filter(
      (q) => !previouslyAsked.has(q.question_text)
    );

    return generatedQuestions.slice(0, count);
  } catch (error) {
    console.error("❌ Error generating questions:", error);
    throw new Error("Failed to generate questions");
  }
}

/**
 * Builds OpenAI prompt dynamically from learner profile and topic parameters
 */
function buildPrompt({ learnerProfile, topicParams, count }) {
  const {
    preferred_difficulty = "medium",
    learning_style = "mixed",
    weak_areas = [],
  } = learnerProfile;

  const {
    complexity_level = "Moderate",
    application_type = "Conceptual",
    retention_importance = "High",
    depth_requirement = "Moderate",
  } = topicParams || {};

  return `
    Generate ${count} multiple-choice questions for a learner with the following traits:
    - Preferred Difficulty: ${preferred_difficulty}
    - Learning Style: ${learning_style}
    - Weak Areas: ${weak_areas.join(", ")}

    Topic characteristics:
    - Complexity Level: ${complexity_level}
    - Application Type: ${application_type}
    - Retention Importance: ${retention_importance}
    - Depth Requirement: ${depth_requirement}

    Format each question as a JSON object with:
    - question_text
    - options (array of 4 strings)
    - correct_answer (must match one of the options)

    Return ONLY a JSON array of questions.
  `;
}