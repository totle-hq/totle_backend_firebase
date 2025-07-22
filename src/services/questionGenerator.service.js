import OpenAI from "openai";
import dotenv from "dotenv";
import { Test } from "../Models/test.model.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateQuestions({
  subject,
    subjectDescription,   // ✅ ADD THIS
  domainDescription,    // ✅ ADD THIS

  domain,
  learnerProfile,
  topicParams,
  topicDescription,
  subtopics,
  topicId,
  topicName,
  userId,
  count = 20,
}) {
  try {
    const prompt = buildPrompt({
      topicName,
      topicDescription,
      topicParams,
      subtopics,
      learnerProfile,
      domain,
        domainDescription,   // ✅ ADD THIS

      subject,
        subjectDescription,  // ✅ ADD THIS

    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    let raw = response.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Failed to parse GPT response:\n", raw);
      throw new Error("Failed to generate questions: Invalid JSON from GPT");
    }

    let { questions = [], answers = [], time_limit_minutes = 30 } = parsed;

    const previousTests = await Test.findAll({
      where: { topic_uuid: topicId, user_id: userId },
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

function buildPrompt({ topicName, topicDescription, topicParams, subtopics, learnerProfile, domain, subject }) {
  const formatParams = (obj) =>
    Object.entries(obj).map(([key, val]) => `${key.replace(/_/g, " ")}: ${val}`).join("\n");

  const formattedSubtopics = subtopics.map((s, i) => `${i + 1}. ${s}`).join("\n");

  return `
You are an AI that generates advanced multiple-choice questions (MCQs) for a qualification test. This test evaluates a candidate's readiness to teach a specific topic on our educational platform. The generation is fully custom, adapting to both the topic's characteristics and the user's profile.

📘 Contextual Framework:
- **Topic**: ${topicName}
- **Description**: ${topicDescription}
- **Subject**: ${subject} — ${subjectDescription}
- **Domain**: ${domain} — ${domainDescription}

📚 Subtopics to be covered (use as question coverage pool):
${formattedSubtopics}

🧠 Learner Profile (33 metrics total):
${formatParams(learnerProfile)}

📊 Topic Parameters (7 instructional modifiers):
${formatParams(topicParams)}

📌 Design Requirements:
- Generate 20 unique MCQs.
- Each MCQ must have 4 options: one correct + 3 plausible distractors.
- Do not repeat questions asked in earlier tests.
- Questions should map the **topic parameters** directly:
  • Complexity Level → match phrasing/difficulty appropriately
  • Engagement Factor → avoid dull, overly technical tone
  • Retention Importance → test memorability-sensitive content
  • Application Type → emphasize real-world or practical usage if practical
  • Cross-domain Relevance → frame questions in boundary-crossing contexts
  • Typical Learning Curve → reflect how quickly users grasp it
  • Depth Requirement → control abstraction and reasoning depth

🎯 Instructional Focus:
Distribute questions into four cognitive categories (max 8 per type):
1. **Recall-Based** – emphasize if Retention is High & user retention is Low
2. **Application-Based** – emphasize if Application is Practical & user lags there
3. **Analytical** – emphasize if Depth is Deep & user critical thinking is weak
4. **Personalized** – must reflect specific low-scoring metrics from learnerProfile

🕒 Time Recommendation Logic:
Default time is 30 minutes. Increase by 2–5 mins if:
- Speed < 40%
- Stress Management < 30%

🚫 Restrictions:
- Do not introduce topics outside the provided subtopics/domain/subject
- Do not explain answers or add commentary
- Format exactly as shown below

🎯 JSON Output Format:
{
  "questions": [
    {
      "id": 1,
      "text": "Sample question text here",
      "options": {
        "A": "Option 1",
        "B": "Option 2",
        "C": "Option 3",
        "D": "Option 4"
      }
    }
  ],
  "answers": [
    {
      "id": 1,
      "correct_answer": "A"
    }
  ],
  "time_limit_minutes": 30
}

Do not explain answers or add commentary.
Strictly adhere to the output format.
`.trim();
}
