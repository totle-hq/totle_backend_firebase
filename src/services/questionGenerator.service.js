import OpenAI from "openai";
import dotenv from "dotenv";
import { Test } from "../Models/test.model.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates unique test questions dynamically via OpenAI
 * Ensures previously generated questions for this user/topic aren't repeated
 *
 * @param {Object} params - Generation parameters
 * @param {Object} params.learnerProfile - User metrics (all 33 parameters)
 * @param {Object} params.topicParams - Topic characteristics (all 7 parameters)
 * @param {string} params.topicId - UUID of the topic
 * @param {string} params.topicName - Topic title
 * @param {string} params.userId - UUID of the user
 * @param {number} params.count - Number of questions
 * @returns {Promise<Object>} - { questions, answers, time_limit_minutes }
 */
export async function generateQuestions({
  learnerProfile,
  topicParams,
  topicId,
  topicName,
  userId,
  count = 20,
}) {
  try {
    const prompt = buildPrompt(topicName, learnerProfile, topicParams);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    const raw = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    let { questions = [], answers = [], time_limit_minutes = 30 } = parsed;

    // Filter out previously asked questions for this user-topic
    const previousTests = await Test.findAll({
      where: { topic_id: topicId, user_id: userId },
      attributes: ["questions"],
    });

    const previouslyAsked = new Set(
      previousTests.flatMap((t) => t.questions.map((q) => q.text || q.question_text))
    );

    questions = questions.filter((q) => !previouslyAsked.has(q.text || q.question_text)).slice(0, count);
    answers = answers.filter((a) => questions.some((q) => q.id === a.id));

    return {
      questions,
      answers,
      time_limit_minutes,
    };
  } catch (error) {
    console.error("❌ Error generating Bridger questions:", error);
    throw new Error("Failed to generate questions");
  }
}

/**
 * Dynamically builds GPT prompt using full learner and topic parameters
 */
function buildPrompt(topicName, userParams, topicParams) {
  const formatParams = (obj) =>
    Object.entries(obj)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${val}`)
      .join("\n");

  return `
  You are an AI that generates high-quality multiple-choice questions (MCQs) for an educational platform. Your task is to create 20 MCQs for a Bridger qualification test to assess a user’s readiness to teach a specific topic, based on their user parameters and the topic’s attributes. The test must be custom-made, emphasizing the user’s weaknesses relative to the topic’s demands while ensuring a comprehensive evaluation.

  Guidelines for MCQ Generation:
  Each question must have four answer choices (one correct, three plausible distractors).  
  Avoid obvious or too-easy answer choices.  
  Do not use phrasing that gives hints about the correct answer.  
  Distribute the 20 questions across four types, with weights adjusted based on user-topic alignment, but cap any single type at 40% (8 questions) to maintain variety:
  Recall-Based: Weight higher if Retention Importance is High and user Retention is Low  
  Application-Based: Weight higher if Application Type is Practical and Practical Application is Low  
  Analytical: Weight higher if Depth is Deep and user Critical Thinking is Low  
  Personalized: At least 4 questions must target weak areas

  Adjust time limit (default 30 mins) based on Speed (<40%) and Stress Management (<30%)

  Input Data:

  Topic Name: ${topicName}

  User Parameters (33 total):
  ${formatParams(userParams)}

  Topic Parameters (7 total):
  ${formatParams(topicParams)}

  Return the response in this exact JSON format:

  {
    "questions": [
      {
        "id": 1,
        "text": "When did Ashoka ascend the throne of the Maurya Empire?",
        "options": {
          "A": "268 BCE",
          "B": "300 BCE",
          "C": "250 BCE",
          "D": "280 BCE"
        }
      }
    ],
    "answers": [
      {
        "id": 1,
        "correct_answer": "A"
      }
    ],
    "time_limit_minutes": 32
  }
  `.trim();
}