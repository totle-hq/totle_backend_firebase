import OpenAI from "openai";
import dotenv from "dotenv";
import { Test } from "../Models/test.model.js";

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

  // Try exact A-D keys first (case-insensitive)
  const direct = ["A", "B", "C", "D"].map(
    (k) => opts[k] ?? opts[k.toLowerCase()]
  );
  let four = direct.filter((v) => v !== undefined);

  // Else fall back to values list (in case model emitted an array or 1..4 keys)
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
    if (!Number.isFinite(id) || !text || text.length < 8) continue;
    if (BANNED_STEM_REGEX.test(text)) continue;

    // dedupe within this batch
    const norm = text.toLowerCase();
    if (seenTexts.has(norm)) continue;

    const options = fixOptions(q?.options);
    if (!options) continue;

    const corr = ansById.get(id);
    if (!["A", "B", "C", "D"].includes(corr)) continue;
    if (!options[corr]) continue;

    cleanQs.push({ id, text, options });
    seenTexts.add(norm);
  }

  const cleanAns = cleanQs.map((q) => ({
    id: q.id,
    correct_answer: ansById.get(q.id),
  }));

  return { questions: cleanQs, answers: cleanAns };
}
/* ------------------------------------------------------------------------ */

export async function generateQuestions({
  subject,
  subjectDescription,     // ✅ used in prompt
  domainDescription,      // ✅ used in prompt
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
      domainDescription,
      subject,
      subjectDescription,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
      // Strongly reduce formatting errors:
      response_format: { type: "json_object" },
      // Generating 20 hard MCQs is verbose; give enough room:
      max_completion_tokens: 3500,
    });

    let raw = response.choices?.[0]?.message?.content || "{}";

    // Just in case:
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Failed to parse GPT response:\n", raw);
      throw new Error("Failed to generate questions: Invalid JSON from GPT");
    }

    let {
      questions: rawQuestions = [],
      answers: rawAnswers = [],
      time_limit_minutes = 30,
    } = parsed;

    // 1) Strictly sanitize (no visuals, valid A–D, etc.)
    let { questions, answers } = sanitizeQA(rawQuestions, rawAnswers);

    // 2) Remove items asked earlier by this user for this topic
    const previousTests = await Test.findAll({
      where: { topic_uuid: topicId, user_id: userId },
      attributes: ["questions"],
    });

    const previouslyAsked = new Set(
      previousTests.flatMap((t) =>
        (t.questions || []).map((q) => toPlain(q.text || q.question_text).toLowerCase())
      )
    );

    questions = questions
      .filter((q) => !previouslyAsked.has(toPlain(q.text).toLowerCase()))
      .slice(0, count);

    // Keep answers aligned to the surviving questions
    const validIds = new Set(questions.map((q) => q.id));
    answers = answers.filter((a) => validIds.has(Number(a.id)));

    return {
      questions,
      answers,
      time_limit_minutes,
    };
  } catch (error) {
console.error("❌ Error generating Bridger questions:", error?.message || error);
throw new Error(error?.message || "Failed to generate questions");

  }
}

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
ROLE: Senior Item Writer for teacher-qualification MCQs.

GOAL: Produce **very difficult**, text-only MCQs that measure both:
(a) deep conceptual mastery of the topic, and
(b) the candidate's ability to TEACH it (diagnose misconceptions, choose next steps, sequence instruction, craft examples).

CONTEXT
- Topic: ${topicName}
- Description: ${topicDescription || ""}
- Subject: ${subject}${subjectDescription ? ` — ${subjectDescription}` : ""}
- Domain: ${domain}${domainDescription ? ` — ${domainDescription}` : ""}

SUBTOPICS (coverage pool; do NOT go outside these):
${formattedSubtopics}

LEARNER PROFILE (33 metrics):
${formatParams(learnerProfile)}

TOPIC PARAMETERS (7 instructional modifiers):
${formatParams(topicParams)}

STRINGENT DESIGN RULES
1) Generate exactly 20 MCQs, IDs 1..20.
2) **Strictly text-only**: NO references to images/figures/graphs/tables/maps/plots/schematics, and NO prompts like "refer to the figure".
3) Each MCQ has exactly 4 options labeled "A", "B", "C", "D". One single correct answer.
4) Ban meta options: "All of the above", "None of the above", "Both A and B", or variants.
5) Difficulty: target upper Bloom's levels — emphasize **application** and **analysis** with subtle near-miss distractors (common misconceptions, boundary conditions, off-by-one traps, “looks-right-but-wrong”).
6) Include **at least 6 teachability checks** (PCK-style), still MCQs, where the stem presents a brief classroom scenario (student error, misconception, next-step choice, example selection, feedback choice, or sequencing). There must be a single best answer grounded in sound pedagogy.
7) Spread coverage across the given subtopics. Do NOT introduce outside content.
8) Option quality: concise, precise, and differentiable. Avoid hand-wavy wording, hedges, or tricks unrelated to the concept.
9) Keep everything self-contained; any data needed must be included as plain text in the stem itself (no external references).
10) No explanations, no commentary — **answers only** as requested in the schema.

COGNITIVE EMPHASIS (follow implicitly; do not label in output)
- Hard Recall (terminology/definitions that are easy to confuse)
- Application (realistic situations / parameterized cases)
- Analytical (counterexamples, edge cases, comparing approaches)
- Personalized (if any low metrics are hinted in learnerProfile, bias a few items toward revealing such weaknesses)

TIME RECOMMENDATION (implicit)
- Default 30 minutes; +2–5 if Speed < 40% or Stress Management < 30%.

OUTPUT — RETURN VALID JSON ONLY (no code fences)
{
  "questions": [
    {
      "id": 1,
      "text": "Stem here (self-contained, text-only; no image/figure references).",
      "options": { "A": "…", "B": "…", "C": "…", "D": "…" }
    }
  ],
  "answers": [
    { "id": 1, "correct_answer": "A" }
  ],
  "time_limit_minutes": 30
}
  Do not explain answers or add commentary. Strictly adhere to the output format.
`

.trim();
}
