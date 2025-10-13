// src/controllers/cpsTestGenerator.controller.js
// -----------------------------------------------------------------------------
// CPS IQ Test Generation Controller
//  - Endpoint: /api/cps/generate-iq-test/:userId
//  - Generates questions AND triggers aggregation if prior responses exist
// -----------------------------------------------------------------------------

import { CpsQuestionGeneratorService, ensureDefaultPipelines } from "../services/cpsQuestionGenerator.service.js";
import { aggregateAndUpsertCpsProfile } from "../services/cpsScoreAggregator.service.js";

/** Default dimension targets */
const DEFAULT_TARGETS = Object.freeze({
  "Comprehension & Reasoning": 5,
  "Creativity & Divergent Thinking": 4,
  "Focus & Cognitive Control": 4,
  "Memory & Retention": 4,
  "Learning Adaptability": 4,
  "Decision-Making & Problem Solving": 4,
});

/* ---------------------- Utilities ---------------------- */
function isUuidLike(v) {
  return typeof v === "string" && /^[0-9a-fA-F-]{10,}$/.test(v);
}

function parseTargets(req) {
  const raw =
    (req.method === "GET" ? req.query.targets : req.body?.targets) || null;
  if (!raw) return { ok: true, value: DEFAULT_TARGETS };

  let obj = null;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Invalid 'targets' JSON." };
    }
  } else if (typeof raw === "object") obj = raw;

  if (!obj || Array.isArray(obj))
    return { ok: false, error: "'targets' must be an object map." };

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "number" || v < 0 || v > 20)
      return { ok: false, error: `Invalid count for dimension '${k}'.` };
  }
  return { ok: true, value: obj };
}

function parseBool(val, def = true) {
  if (val === undefined || val === null) return def;
  if (typeof val === "boolean") return val;
  if (typeof val === "string")
    return ["1", "true", "yes", "y"].includes(val.toLowerCase());
  return def;
}

/* ---------------------- Main controller ---------------------- */
export async function generateIqTestController(req, res) {
  try {
    const { userId } = req.params || {};
    if (!userId || !isUuidLike(userId))
      return res.status(400).json({ ok: false, error: "Invalid or missing userId." });

    const targetsParsed = parseTargets(req);
    if (!targetsParsed.ok)
      return res.status(400).json({ ok: false, error: targetsParsed.error });

    const targets = targetsParsed.value;
    const newUserOnlyFallback =
      req.method === "GET"
        ? parseBool(req.query.newUserOnlyFallback, true)
        : parseBool(req.body?.newUserOnlyFallback, true);

    // Ensure pipeline registry entries exist
    await ensureDefaultPipelines();

    // Inject Socket.IO if present
    const io = req.app?.get ? req.app.get("io") : null;

    // 1️⃣ Generate questions and persist them
    const service = new CpsQuestionGeneratorService({ io });
    const result = await service.generateIQTestForUser({
      userId,
      targets,
      newUserOnlyFallback,
    });

    // 2️⃣ Optionally aggregate if responses already exist (safe re-compute)
    try {
      await aggregateAndUpsertCpsProfile({ userId, context_type: "IQ" });
    } catch (aggErr) {
      console.warn(`[CPS] Aggregation skipped or failed for ${userId}:`, aggErr.message);
    }

    // 3️⃣ Return result
    return res.status(200).json({
      ok: true,
      batch_id: result.batch_id,
      generation_batch_key: result.generation_batch_key,
      questions: result.questions,
      message: "IQ test generated successfully; CPS aggregation re-checked.",
    });
  } catch (err) {
    console.error("[CPS] generateIqTestController error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error while generating IQ test.",
    });
  }
}

export async function generateIqTestControllerPost(req, res) {
  return generateIqTestController(req, res);
}
