// src/services/questionGenerator.service.js
import OpenAI from "openai";
import dotenv from "dotenv";
import { Test } from "../Models/test.model.js";
import { checkApiBudget } from "./questionMaintenance.service.js";
import { QuestionPool } from "../Models/Fallback/QuestionsPool.js";
import nodemailer from "nodemailer";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ----------------------- HARD VALIDATION GUARDRAILS ---------------------- */
const BANNED_STEM_REGEX =
  /\b(figure|diagram|image|graph|chart|plot|map|table|schematic|blueprint|heat\s?map|refer to|see (the )?(figure|diagram|image|graph|chart|table))\b/i;

const BANNED_OPTION_REGEX =
  /\b(all of the above|none of the above|both\s*a\s*and\s*b|a\s*&\s*b|a and b only|a,?\s*b(,?\s*c)? and d)\b/i;

const toPlain = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function fixOptions(opts) {
  if (!opts || typeof opts !== "object") return null;
  const direct = ["A", "B", "C", "D"].map(
    (k) => opts[k] ?? opts[k.toLowerCase()]
  );
  let four = direct.filter((v) => v !== undefined);

  if (four.length !== 4) {
    const vals = Array.isArray(opts) ? opts : Object.values(opts);
    four = vals.filter(Boolean).slice(0, 4);
  }
  if (four.length !== 4) return null;

  const cleaned = four.map(toPlain);
  if (cleaned.some((t) => !t || BANNED_OPTION_REGEX.test(t))) return null;
  return { A: cleaned[0], B: cleaned[1], C: cleaned[2], D: cleaned[3] };
}

function sanitizeQA(questions = [], answers = []) {
  const ansById = new Map(
    answers.map((a) => [
      Number(a?.id),
      String(a?.correct_answer ?? "").trim().toUpperCase(),
    ])
  );
  const seenTexts = new Set();
  const cleanQs = [];

  for (const q of questions) {
    const id = Number(q?.id);
    const text = toPlain(q?.text ?? q?.question_text);

    if (!Number.isFinite(id)) {
      console.log("⛔ Dropped (bad id):", q);
      continue;
    }
    if (!text) {
      console.log("⛔ Dropped (no text):", q);
      continue;
    }
    if (text.length < 2) {  // relaxed for baseline
      console.log("⛔ Dropped (too short):", text);
      continue;
    }
    if (BANNED_STEM_REGEX.test(text)) {
      console.log("⛔ Dropped (banned stem):", text);
      continue;
    }

    const norm = text.toLowerCase();
    if (seenTexts.has(norm)) {
      console.log("⛔ Dropped (duplicate stem):", text);
      continue;
    }

    const options = fixOptions(q?.options);
    if (!options) {
      console.log("⛔ Dropped (bad options):", q?.options);
      continue;
    }

    const corr = ansById.get(id);
    if (!["A", "B", "C", "D"].includes(corr)) {
      console.log("⛔ Dropped (bad answer):", corr, "for Q", text);
      continue;
    }
    if (!options[corr]) {
      console.log("⛔ Dropped (answer key missing in options):", corr, options);
      continue;
    }

    cleanQs.push({ id, text, options });
    seenTexts.add(norm);
  }

  const cleanAns = cleanQs.map((q) => ({
    id: q.id,
    correct_answer: ansById.get(q.id),
  }));

  console.log("✅ Sanitizer accepted:", cleanQs.length, "of", questions.length);
  return { questions: cleanQs, answers: cleanAns };
}

async function callYourExistingAI({ topicName, topicId, userId, dimension, count }) {
  const { questions, answers } = await generateQuestions({
    topicName,
    topicParams: { dimension_focus: dimension },
    topicId,
    userId,
    count,
  });

  return questions.map((q) => ({
    text: q.text,
    options: q.options,
    correct_answer: answers.find((a) => a.id === q.id)?.correct_answer,
  }));
}


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // App password (if using Gmail)
  },
});


export async function sendMail({ to, subject, text }) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log("📧 Admin notified via email");
  } catch (err) {
    console.error("❌ Failed to send alert email", err);
  }
}

export async function generateQuestionsForDimension({
  topicName,
  topicId,
  userId,
  dimension,
  count,
}) {
  console.log('GenQforDime', topicId)
  console.log(
    `🤖 [AI] Generating ${count} questions for dimension: ${dimension}`
  );

  // reuse your existing prompt logic internally
  const questions = await callYourExistingAI({
    topicName,
    topicId,
    userId,
    dimension,
    count,
  });

  console.log(
    `✅ [AI] Generated ${questions.length}/${count} for ${dimension}`
  );

  return questions;
}


/* ----------------------- MAIN GENERATOR ---------------------- */
export async function generateQuestions({
  subject,
  subjectDescription,
  domainDescription,
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
    const topic_uuid = topicId;
    console.log("topic-uuid", topic_uuid);

    const { overLimit, notice } = await checkApiBudget();

    if (overLimit) {
      console.warn("❌ API budget exceeded. Fallback initiated.");

      // 2️⃣ Notify admin
      await sendMail({
        to: "example@gmail.com",
        subject: `⚠️ [Fallback Used] API Budget Limit Hit`,
        text: `AI budget exceeded for user: ${userId}, topic: ${topicName}\nA fallback set of questions was used instead.`
      });


      const userWrongOrUnanswered = [];

      const testRecords = await Test.findAll({
        where: {
          topic_uuid,
          user_id: userId,
        },
        order: [["createdAt", "DESC"]],
        limit: 20,
      });

      for (const test of testRecords) {
        const questions = test.questions || [];
        const submitted = test.answers_submitted || {};
        const answers = test.answers || [];

        for (const q of questions) {
          const userAnswer = submitted[q.id];
          const correctAnswer = answers.find(a => a.id === q.id)?.correct_answer;

          if (!userAnswer || userAnswer !== correctAnswer) {
            userWrongOrUnanswered.push({
              topic_uuid,
              dimension: q.dimension,
              question: q,
              correct_answer: correctAnswer,
              usage_count: 99,
              is_buffer: true,
            });
          }
        }
      }


      // 3️⃣ Attempt to fetch reusable pool questions
      const fallbackQuestions = await QuestionPool.findAll({
        where: {
          topic_uuid,
          usage_count: { [Op.lt]: 3 },
          is_archived: false,
        },
        order: [["usage_count", "ASC"]],
        limit: count,
      });

      if (fallbackQuestions.length === 0) {
        throw new Error("No fallback questions available");
      }


      // Deduplicate by question text
      const seen = new Set(
        fallbackQuestions.map(q =>
          q.question?.text?.toLowerCase()
        )
      );

      // Add wrong/unanswered questions next
      for (const q of userWrongOrUnanswered) {
        if (fallbackQuestions.length >= count) break;

        const textKey = q.question?.text?.toLowerCase();
        if (!seen.has(textKey)) {
          fallbackQuestions.push(q);
          seen.add(textKey);
        }
      }

      return {
        questions: fallbackQuestions.map(q => ({
          text: q.question.text,
          options: q.question.options,
          correct_answer: q.correct_answer,
          dimension: q.dimension,
        })),
        answers: [], // leave empty
        time_limit_minutes: 30,
        notice,
      };
    }
    const batchSize = 4; // 5 parallel batches * 4 = 20
    const numBatches = Math.ceil(count / batchSize);

    const prompts = Array.from({ length: numBatches }, (_, i) => {
      const idStart = i * batchSize + 1;
      return buildPrompt({
        topicName,
        topicDescription,
        topicParams,
        subtopics,
        learnerProfile,
        domain,
        domainDescription,
        subject,
        subjectDescription,
        count: batchSize,
        offset: i * batchSize,
        idStart
      });
    });

    console.log(`🚀 Launching ${numBatches} parallel batches...`);

    const responses = await Promise.all(
      prompts.map((prompt, i) =>
        openai.chat.completions
          .create({
            model: "gpt-4o-mini", // ✅ switched from gpt-5-mini
            messages: [{ role: "user", content: prompt }],
            temperature: 1,
            response_format: { type: "json_object" },
            max_completion_tokens: 1800,
          })
          .then((res) => {
            let raw = res.choices?.[0]?.message?.content || "{}";
            raw = raw.replace(/```json|```/g, "").trim();
            try {
              const parsed = JSON.parse(raw);
              console.log(`✅ Batch ${i + 1} parsed with`, parsed?.questions?.length || 0, "questions");
              return parsed;
            } catch (err) {
              console.error(`❌ Batch ${i + 1} parse failed`);
              return { questions: [], answers: [] };
            }
          })
      )
    );

    const rawQuestions = responses.flatMap((r) => r.questions || []);
    const rawAnswers = responses.flatMap((r) => r.answers || []);
    console.log("🔹 Total raw questions from pipelines:", rawQuestions.length);

    // Sanitize
    let { questions, answers } = sanitizeQA(rawQuestions, rawAnswers);

    // Deduplicate against user’s past
    const previousTests = await Test.findAll({
      where: { topic_uuid, user_id: userId },
      attributes: ["questions"],
    });

    const previouslyAsked = new Set(
      previousTests.flatMap((t) =>
        (t.questions || []).map((q) =>
          toPlain(q.text || q.question_text).toLowerCase()
        )
      )
    );

    questions = questions
      .filter((q) => !previouslyAsked.has(toPlain(q.text).toLowerCase()))
      .slice(0, count);

    const validIds = new Set(questions.map((q) => q.id));
    answers = answers.filter((a) => validIds.has(Number(a.id)));

    if (questions.length < count) {
      console.warn(
        `⚠️ [GENERATOR] Topic="${topicName}" | Dimension="${topicParams?.dimension_focus}" | ${questions.length}/${count}`
      );
    }

    return {
      questions,
      answers,
      time_limit_minutes: 30,
    };
  } catch (error) {
    console.error("❌ Error generating questions:", error?.message || error);
    throw new Error(error?.message || "Failed to generate questions");
  }
}

/* ----------------------- PROMPT ---------------------- */
function buildPrompt({
  topicName = "",
  topicDescription = "",
  topicParams = {},
  subtopics = [],
  learnerProfile = {},
  domain = "",
  subject = "",
  subjectDescription = "",
  domainDescription = "",
  count = 4,
  offset = 0,
  idStart = 1
}) {
  const formatParams = (obj) =>
    Object.entries(obj)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .join("\n");

  const formattedSubtopics =
    Array.isArray(subtopics) && subtopics.length > 0
      ? subtopics.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "None specified";

  return `
    ROLE: You are a **senior assessment designer** specializing in teacher-qualification multiple-choice questions (MCQs) for advanced learners.

    OBJECTIVE: Generate **very difficult, text-only MCQs** that assess conceptual understanding, application, and analysis.  
    Each MCQ must have **exactly one correct option** that is indisputably correct, while the remaining three options must be **unique, plausible, but provably wrong**.  
    Ambiguity, overlaps, or trick phrasing are strictly forbidden.

    CONTEXT:
    - Domain: ${domain}${domainDescription ? ` — ${domainDescription}` : ""}
    - Subject: ${subject}${subjectDescription ? ` — ${subjectDescription}` : ""}
    - Topic: ${topicName}${topicDescription ? ` — ${topicDescription}` : ""}
    - Subtopics (coverage pool only; do not go outside these):
    ${formattedSubtopics}

    LEARNER PROFILE:
    ${formatParams(learnerProfile)}

    TOPIC PARAMETERS:
    ${formatParams(topicParams)}

    STRICT QUESTION-WRITING RULES:
    1. Generate exactly ${count} MCQs, with IDs ${idStart}..${idStart + count - 1}.
    2. Text-only: no references to images, figures, graphs, charts, tables, maps, plots, or schematics.
    3. Each question must contain a **complete context** within its stem; it must stand alone without external reference.
    4. Provide exactly four options labeled "A", "B", "C", and "D".
    5. Only one option can be correct. The other three must each:
      - Be unique (no repetition or semantic overlap).
      - Be plausible distractors consistent with the topic.
      - Contain no phrases like “All of the above”, “None of the above”, “Both A and B”, etc.
    6. The correct answer must be fully justified by the information in the stem.
    7. The difficulty level must reflect Bloom’s “Application” and “Analysis” tiers.
    8. Each batch must include at least 2 pedagogy-related or teachability-based questions.
    9. The language must be formal, academic, and unambiguous.
    10. Do not include explanations, reasoning, or commentary — **only the JSON object**.

    OUTPUT FORMAT (valid JSON only):
    {
      "questions": [
        {
          "id": (each ID from ${idStart} to ${idStart + count - 1}),
          "text": "Stem here",
          "options": {
            "A": "Option text",
            "B": "Option text",
            "C": "Option text",
            "D": "Option text"
          }
        }
      ],
      "answers": [
        { "id": (same ID as the corresponding question), "correct_answer": "One of A, B, C, or D — randomly assigned" }
      ]
    }

    Make sure:
    - The JSON is valid and strictly matches this format.
    - The options are **distinct, concise, and logically consistent**.
    - Exactly one correct option exists for each question.
      `.trim();
}

