// src/services/cps/orchestrateCpsGeneration.service.js
import OpenAI from "openai";
import dotenv from "dotenv";
import { CPS_KEYS } from "./cpsKeys.js";  // ✅ already in repo, reuse it

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------------------------------------------------------------- */
/* Guards                                                                     */
/* -------------------------------------------------------------------------- */
const BANNED_STEM_REGEX =
  /\b(figure|diagram|image|graph|chart|plot|map|table|schematic|blueprint|heat\s?map|refer to|see (the )?(figure|diagram|image|graph|chart|table))\b/i;
const BANNED_OPTION_REGEX =
  /\b(all of the above|none of the above|both\s*a\s*and\s*b|a\s*&\s*b|a and b only|a,?\s*b(,?\s*c)? and d)\b/i;

const toPlain = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function normalizeStem(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function commonOverlap(a, b) {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  const common = [...wordsA].filter((w) => wordsB.has(w));
  return common.length / Math.max(wordsA.size, wordsB.size);
}

function isTooSimilar(stem, seenSet) {
  const norm = normalizeStem(stem);
  if (seenSet.has(norm)) return true;
  for (const s of seenSet) {
    if (norm.includes(s) || s.includes(norm)) return true;
    const overlap = commonOverlap(norm, s);
    if (overlap > 0.85) return true;
  }
  return false;
}

function fixOptions(opts) {
  if (!opts || typeof opts !== "object") return null;
  const ABCD = ["A", "B", "C", "D"];
  const direct = ABCD.map((k) => opts[k] ?? opts[k.toLowerCase()]);
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

/* -------------------------------------------------------------------------- */
/* Sanitizer                                                                  */
/* -------------------------------------------------------------------------- */
function sanitizeItems(rawQuestions = [], rawAnswers = [], globalSeen) {
  const ansById = new Map(
    rawAnswers.map((a) => [Number(a?.id), String(a?.correct_answer ?? "").trim().toUpperCase()])
  );
  const items = [];
  const justSeenThisCall = new Set();

  for (const q of rawQuestions) {
    const id = Number(q?.id);
    const text = toPlain(q?.text ?? q?.question_text);

    if (!Number.isFinite(id) || !text || text.length < 8) continue;
    if (BANNED_STEM_REGEX.test(text)) continue;

    const norm = normalizeStem(text);
    if (globalSeen.has(norm) || justSeenThisCall.has(norm)) continue;
    if (isTooSimilar(text, globalSeen)) continue;

    const options = fixOptions(q?.options);
    if (!options) continue;

    const corr = ansById.get(id);
    if (!["A", "B", "C", "D"].includes(corr)) continue;
    if (!options[corr]) continue;

    items.push({ id, text, options, answer: corr });
    justSeenThisCall.add(norm);
  }
  return items;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */
export async function generateCpsQuestionSet({
  subject = "",
  subjectDescription = "",
  domain = "",
  domainDescription = "",
  topicName = "",
  topicDescription = "",
  subtopics = [],
  learnerProfile = {},
  params = { topicParams: {}, domainParams: {} },
  isBaseline = false,
  onProgress,
}) {
  const PLAN = {
    reasoning_strategy: 6,
    metacognition_selfreg: 4,
    memory_retrieval: 3,
    speed_fluency: 3,
    attention_focus: 2,
    resilience_adaptability: 2,
    teaching: 5,
  };

  const order = [
    { key: "reasoning_strategy", label: "Generating Reasoning & Strategy…" },
    { key: "metacognition_selfreg", label: "Generating Metacognition & Self-Regulation…" },
    { key: "memory_retrieval", label: "Generating Memory & Retrieval…" },
    { key: "speed_fluency", label: "Generating Processing Speed & Fluency…" },
    { key: "attention_focus", label: "Generating Attention & Focus…" },
    { key: "resilience_adaptability", label: "Generating Resilience & Adaptability…" },
    { key: "teaching", label: "Generating Teaching Ability (minimal probe)…" },
  ];

  const steps = [];
  const globalSeenStems = new Set();
  const model = process.env.OPENAI_CPS_MODEL || "gpt-4o-mini";

  // --- per block fetching ---
  for (const s of order) {
    const targetCount = PLAN[s.key];
    if (targetCount <= 0) continue;

    onProgress?.({ phase: s.key, status: "progress", note: s.label });

    let collected = [];
    let tries = 0;

    while (collected.length < targetCount && tries < 5) {
      tries++;
      const avoidStems = Array.from(globalSeenStems).slice(-50);

      const prompt = buildPrompt({
        blockKey: s.key,
        count: targetCount - collected.length,
        isBaseline,
        subject,
        subjectDescription,
        domain,
        domainDescription,
        topicName,
        topicDescription,
        subtopics,
        learnerProfile,
        params,
        avoidStems,
      });

      try {
        const parsed = await callOpenAI({
          model,
          prompt,
          system: systemMessage(),
          max_tokens: 3500,
        });

        const items = sanitizeItems(parsed.questions, parsed.answers, globalSeenStems);
        const rubricsById = new Map((parsed.rubrics || []).map((r) => [Number(r?.id), r]));

        for (const it of items) {
          if (collected.length >= targetCount) break;
          const norm = normalizeStem(it.text);
          if (globalSeenStems.has(norm) || isTooSimilar(it.text, globalSeenStems)) continue;
          const rubric = coerceRubric(rubricsById.get(it.id), s.key);
          collected.push({ ...it, rubric });
          globalSeenStems.add(norm);
        }
      } catch (err) {
        console.warn(`[CPS:${s.key}] try ${tries} failed:`, err?.message || err);
      }
    }

    steps.push({
      key: s.key,
      items: collected,
      recommendedTimeMin: defaultTimeForBlock(s.key),
    });

    onProgress?.({
      phase: s.key,
      status: "done",
      note: `${collected.length}/${targetCount} items ready`,
    });
  }

  // --- global safeguard: ensure at least 25 ---
  let total = steps.reduce((acc, st) => acc + st.items.length, 0);
  let fallbackTries = 0;

  while (total < 25 && fallbackTries < 50) {
    fallbackTries++;
    // cycle blocks
    const block = order[fallbackTries % order.length];
    const prompt = buildPrompt({
      blockKey: block.key,
      count: 1,
      isBaseline,
      subject,
      subjectDescription,
      domain,
      domainDescription,
      topicName,
      topicDescription,
      subtopics,
      learnerProfile,
      params,
      avoidStems: Array.from(globalSeenStems).slice(-50),
    });

    try {
      const parsed = await callOpenAI({
        model,
        prompt,
        system: systemMessage(),
        max_tokens: 1200,
      });
      const items = sanitizeItems(parsed.questions, parsed.answers, globalSeenStems);
      if (items.length > 0) {
        const rubricsById = new Map((parsed.rubrics || []).map((r) => [Number(r?.id), r]));
        const it = items[0];
        const norm = normalizeStem(it.text);
        if (!globalSeenStems.has(norm)) {
          const rubric = coerceRubric(rubricsById.get(it.id), block.key);
          const merged = { ...it, rubric };
          const step = steps.find((st) => st.key === block.key);
          if (step) step.items.push(merged);
          else {
            steps.push({
              key: block.key,
              items: [merged],
              recommendedTimeMin: defaultTimeForBlock(block.key),
            });
          }
          globalSeenStems.add(norm);
          total++;
        }
      }
    } catch (err) {
      console.warn(`[Fallback:${block.key}] failed:`, err?.message || err);
    }
  }

  const totalRecommendedTimeMin =
    steps.reduce((acc, st) => acc + (st.recommendedTimeMin || 0), 0) || 35;

  return { steps, totalRecommendedTimeMin };
}

/* -------------------------------------------------------------------------- */
/* Prompt construction                                                        */
/* -------------------------------------------------------------------------- */
function systemMessage() {
  return [
    "You are a senior psychometrician and item writer.",
    "Design high-quality MCQs that primarily test TOPIC EXPERTISE across 6 CPS dimensions:",
    "reasoning_strategy, metacognition_selfreg, memory_retrieval, speed_fluency, attention_focus, resilience_adaptability.",
    "Avoid images, charts, meta-options. Each item must be unique.",
    "For every item, produce a rubric where:",
    "- option_impacts contains ALL CPS parameters (47 keys) as numeric deltas −1..+1.",
    `  Full list of CPS keys: ${CPS_KEYS.join(", ")}.`,
    "- If a parameter is unaffected by that option, set its value = 0.",
    "- gates must include at least { teaching_floor: boolean, unsafe: boolean }.",
    "Output only in JSON as specified.",
  ].join(" ");
}


function buildPrompt({
  blockKey,
  count,
  isBaseline,
  subject,
  subjectDescription,
  domain,
  domainDescription,
  topicName,
  topicDescription,
  subtopics = [],
  learnerProfile = {},
  params = {},
  avoidStems = [],
}) {
  const avoidList = avoidStems && avoidStems.length
    ? `Avoid reusing or paraphrasing these stems:\n- ${avoidStems.join("\n- ")}`
    : "";

  const subtopicText = subtopics.length
    ? `Focus also on subtopics: ${subtopics.join(", ")}.`
    : "";

  const profileText = learnerProfile && Object.keys(learnerProfile).length
    ? `Learner profile hints: ${JSON.stringify(learnerProfile)}`
    : "";

  const paramText = params && Object.keys(params).length
    ? `Context parameters: ${JSON.stringify(params)}`
    : "";

  return [
    `Generate ${count} high-quality multiple-choice questions (MCQs).`,
    `Dimension focus: ${blockKey}.`,
    `Subject: ${subject} — ${subjectDescription || "no description"}.`,
    `Domain: ${domain} — ${domainDescription || "no description"}.`,
    `Topic: ${topicName} — ${topicDescription || "no description"}.`,
    subtopicText,
    profileText,
    paramText,
    avoidList,
    "",
    "Each item must be unique, clear, and text-only.",
    "Each item must have exactly 4 distinct options (A–D).",
"Each item must have one correct answer key (A/B/C/D). The correct answer must be indisputably correct and randomly distributed across A–D.",
"For each item, also produce a rubric with:",
`- option_impacts: mapping A–D → { ${CPS_KEYS.join(", ")} }, each key having a −1..+1 numeric delta (0 if not impacted).`,
"- gates: e.g. { teaching_floor: true/false, unsafe: true/false }",

    "",
    "Output strictly in JSON with shape:",
    "{",
    '  "questions": [ { "id": <int>, "text": <string>, "options": { "A":..,"B":..,"C":..,"D":.. } } ],',
    '  "answers": [ { "id": <int>, "correct_answer": "A|B|C|D" } ],',
    '  "rubrics": [ { "id": <int>, "option_impacts": { "A":{..}, "B":{..}, "C":{..}, "D":{..} }, "gates":{..} } ]',
    "}",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* OpenAI call                                                                */
/* -------------------------------------------------------------------------- */
async function callOpenAI({ model, prompt, system, max_tokens = 3500 }) {
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    max_tokens,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ],
  });

  let raw = response.choices?.[0]?.message?.content || "{}";
  raw = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

/* -------------------------------------------------------------------------- */
/* Rubric coercion                                                            */
/* -------------------------------------------------------------------------- */

function coerceRubric(r = {}, blockKey) {
  const out = { option_impacts: {}, gates: {}, block: blockKey };

  for (const opt of ["A", "B", "C", "D"]) {
    const entry = r?.option_impacts?.[opt];
    const clean = {};

    // Copy only valid numeric params
    if (entry && typeof entry === "object") {
      for (const [k, v] of Object.entries(entry)) {
        const num = Number(v);
        if (Number.isFinite(num)) clean[k] = num;
      }
    }

    // ✅ Guarantee full 47-param coverage
    for (const key of CPS_KEYS) {
      if (!(key in clean)) clean[key] = 0;
    }

    out.option_impacts[opt] = clean;
  }

  out.gates = {
    teaching_floor: Boolean(r?.gates?.teaching_floor) || false,
    unsafe: Boolean(r?.gates?.unsafe) || false,
  };

  return out;
}


/* -------------------------------------------------------------------------- */
/* Views + EMA helpers                                                        */
/* -------------------------------------------------------------------------- */
export function toFrontendView(result) {
  return {
    blocks: result.steps.map((s, bi) => ({
      key: s.key,
      order: bi + 1,
      recommendedTimeMin: s.recommendedTimeMin,
      questions: s.items.map((it) => ({ id: it.id, text: it.text, options: it.options })),
    })),
    totalRecommendedTimeMin: result.totalRecommendedTimeMin,
  };
}

export function toBackendEvalPack(result) {
  return {
    steps: result.steps.map((s) => ({
      key: s.key,
      answers: s.items.map((it) => ({ id: it.id, correct_answer: it.answer })),
      rubrics: s.items.map((it) => ({ id: it.id, rubric: it.rubric })),
    })),
  };
}

export function ewmaUpdate(prev, delta, alpha = 0.35) {
  if (prev == null || Number.isNaN(prev)) return delta;
  return alpha * delta + (1 - alpha) * prev;
}

export function aggregateParamScore(arr) {
  const wsum = arr.reduce((m, a) => m + (a.weight || 0), 0) || 1;
  const ok = arr.reduce((m, a) => m + (a.correct ? a.weight || 0 : 0), 0);
  return ok / wsum;
}

function defaultTimeForBlock(blockKey) {
  const m = {
    reasoning_strategy: 12,
    metacognition_selfreg: 8,
    memory_retrieval: 6,
    speed_fluency: 6,
    attention_focus: 5,
    resilience_adaptability: 5,
    teaching: 5,
  };
  return m[blockKey] || 5;
}
