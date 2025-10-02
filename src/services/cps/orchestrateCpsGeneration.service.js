// src/services/cps/orchestrateCpsGeneration.service.js
import OpenAI from "openai";
import dotenv from "dotenv";
import { CPS_KEYS } from "./cpsKeys.js";
import fs from "fs";
import path from "path";
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
/* Broken JSON logger                                                         */
/* -------------------------------------------------------------------------- */
function logBrokenJson(raw, phase) {
  try {
    const outPath = path.join(process.cwd(), `broken_json_${phase}_${Date.now()}.txt`);
    fs.writeFileSync(outPath, raw || "");
    console.warn(`⚠️ Logged broken JSON to ${outPath}`);
  } catch (e) {
    console.error("⚠️ Failed to log broken JSON:", e.message);
  }
}

/* -------------------------------------------------------------------------- */
/* Main generator                                                             */
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
  // PLAN: baseline split into 4 neutral pipelines
  const PLAN = isBaseline
    ? { baseline_reasoning: 5, baseline_memory: 5, baseline_speed: 5, baseline_misc: 5 }
    : {
        reasoning_strategy: 6,
        metacognition_selfreg: 4,
        memory_retrieval: 3,
        speed_fluency: 3,
        attention_focus: 2,
        resilience_adaptability: 2,
        teaching: 5,
      };

  const order = Object.keys(PLAN).map((k) => ({ key: k, label: `Generating ${k}…` }));
  const steps = [];
  const globalSeenStems = new Set();
  const model = process.env.OPENAI_CPS_MODEL || "gpt-4.1";

  for (const s of order) {
    const targetCount = PLAN[s.key];
    onProgress?.({ phase: s.key, status: "progress", note: s.label });
    console.log(`[${isBaseline ? "Baseline" : "CPS"}:${s.key}] Need ${targetCount}`);

    let collected = [];
    let tries = 0;

    while (collected.length < targetCount && tries < 15) {
      tries++;
      console.log(`[${s.key}] Attempt ${tries} (${collected.length}/${targetCount})`);
      const prompt = buildPrompt({
        blockKey: s.key,
        count: Math.min(2, targetCount - collected.length),
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
          max_completion_tokens: 1200,
        });
        const items = sanitizeItems(parsed.questions, parsed.answers, globalSeenStems);
        for (const it of items) {
          if (collected.length >= targetCount) break;
          const norm = normalizeStem(it.text);
          if (globalSeenStems.has(norm) || isTooSimilar(it.text, globalSeenStems)) continue;

          const rubric = isBaseline
            ? { option_impacts: {}, gates: {}, block: "baseline" }
            : coerceRubric((parsed.rubrics || []).find((r) => Number(r?.id) === it.id), s.key);

          collected.push({ ...it, rubric });
          globalSeenStems.add(norm);
        }
      } catch (err) {
        console.warn(`[${s.key}] Parse failed:`, err.message);
        logBrokenJson(err?.raw || "", s.key);
      }
    }

    steps.push({ key: s.key, items: collected, recommendedTimeMin: isBaseline ? 30 : defaultTimeForBlock(s.key) });
    onProgress?.({ phase: s.key, status: "done", note: `${collected.length}/${targetCount} items ready` });
  }

  // fallback: top up until 20 baseline or 25 CPS
  const minTarget = isBaseline ? 20 : 25;
  let total = steps.reduce((a, s) => a + s.items.length, 0);
  let fallbackTries = 0;
  while (total < minTarget && fallbackTries < 40) {
    fallbackTries++;
    const block = order[fallbackTries % order.length];
    console.log(`[Fallback:${block.key}] Try ${fallbackTries} total ${total}`);
    onProgress?.({ phase: "fallback", status: "progress", note: `Top-up attempt ${fallbackTries}` });
    try {
      const parsed = await callOpenAI({
        model,
        prompt: buildPrompt({
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
        }),
        system: systemMessage(),
        max_completion_tokens: 800,
      });
      const items = sanitizeItems(parsed.questions, parsed.answers, globalSeenStems);
      if (items.length) {
        steps[0].items.push({ ...items[0], rubric: isBaseline ? { option_impacts: {}, gates: {}, block: "baseline" } : coerceRubric({}, block.key) });
        total++;
      }
    } catch (err) {
      logBrokenJson(err?.raw || "", `fallback_${block.key}`);
    }
  }

  const totalRecommendedTimeMin = steps.reduce((a, s) => a + (s.recommendedTimeMin || 0), 0) || (isBaseline ? 30 : 35);
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
  const avoidList =
    avoidStems && avoidStems.length
      ? `Avoid reusing or paraphrasing these stems:\n- ${avoidStems.join("\n- ")}`
      : "";

  const subtopicText = subtopics.length
    ? `Focus also on subtopics: ${subtopics.join(", ")}.`
    : "";

  const profileText =
    learnerProfile && Object.keys(learnerProfile).length
      ? `Learner profile hints: ${JSON.stringify(learnerProfile)}`
      : "";

  const paramText =
    params && Object.keys(params).length
      ? `Context parameters: ${JSON.stringify(params)}`
      : "";

  /* -------------------- Baseline prompt -------------------- */
  if (isBaseline) {
    return [
      `Generate ${count} straightforward multiple-choice questions (MCQs) to test basic understanding of the topic.`,
      `Do not mention dimensions like reasoning/memory/speed. Just focus on the subject and topic.`,
      `Subject: ${subject} — ${subjectDescription || "no description"}.`,
      `Domain: ${domain} — ${domainDescription || "no description"}.`,
      `Topic: ${topicName} — ${topicDescription || "no description"}.`,
      subtopicText,
      profileText,
      paramText,
      avoidList,
      "",
      "Each question must:",
      "- Be clear, age-appropriate, and text-only.",
      "- Have exactly 4 distinct options labeled A–D.",
      "- Have one correct answer key (A/B/C/D).",
      "- Avoid trick options like 'all of the above' or 'none of the above'.",
      "",
      "Output strictly in JSON with shape:",
      "{",
      '  "questions": [ { "id": <int>, "text": <string>, "options": { "A":..,"B":..,"C":..,"D":.. } } ],',
      '  "answers": [ { "id": <int>, "correct_answer": "A|B|C|D" } ]',
      "}",
    ].join("\n");
  }

  /* -------------------- CPS prompt -------------------- */
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
function extractJsonBlock(str) {
  if (!str) return null;
  const start = str.indexOf("{");
  const end = str.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return str.slice(start, end + 1);
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const block = extractJsonBlock(raw);
    if (block) {
      try { return JSON.parse(block); } catch {}
    }
  }
  return null;
}

function lastValidJsonSlice(raw) {
  if (!raw) return "{}";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1) return "{}";
  return raw.slice(start, end + 1);
}


async function callOpenAI({ model, prompt, system, max_completion_tokens = 2000 }) {
  const baseMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: prompt },
  ];

  let raw = "";
  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 1,
      response_format: { type: "json_object" },
      max_completion_tokens,
      messages: baseMessages,
    });

    raw = response.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    const parsed = safeParse(raw);
    if (parsed) return parsed;

    throw new Error("Parse failed");
  } catch (err) {
    console.warn("⚠️ Initial JSON parse failed:", err.message);

    // 🔑 Preserve raw in error for logging
    err.raw = raw;

    // Try repair
    try {
      const slice = lastValidJsonSlice(raw);
      const repairResponse = await openai.chat.completions.create({
        model,
        temperature: 1,
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
        messages: [
          {
            role: "system",
            content: "You are a JSON repair assistant. Only return valid JSON. No explanations.",
          },
          {
            role: "user",
            content: `Fix this truncated/invalid JSON so it is valid and matches schema:\n\n${slice}`,
          },
        ],
      });

      let fixed = repairResponse.choices?.[0]?.message?.content || "{}";
      fixed = fixed.replace(/```json|```/g, "").trim();
      const parsedFixed = safeParse(fixed);
      if (parsedFixed) return parsedFixed;

      throw new Error("Repair parse failed");
    } catch (repairErr) {
      console.error("❌ JSON repair also failed:", repairErr.message);
      // 🔑 return empty instead of crashing whole loop
      return { questions: [], answers: [], rubrics: [] };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Rubric coercion                                                            */
/* -------------------------------------------------------------------------- */
function coerceRubric(r = {}, blockKey) {
  const out = { option_impacts: {}, gates: {}, block: blockKey };

  for (const opt of ["A", "B", "C", "D"]) {
    const entry = r?.option_impacts?.[opt];
    const clean = {};

    if (entry && typeof entry === "object") {
      for (const [k, v] of Object.entries(entry)) {
        const num = Number(v);
        if (Number.isFinite(num)) clean[k] = num;
      }
    }

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
