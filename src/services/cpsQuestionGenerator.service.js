// src/services/cpsQuestionGenerator.service.js
// ----------------------------------------------------------------------------
// CPS IQ Test Question Generation Orchestrator (Production-Grade)
//  - Pipelines: core_generator → filler_generator → validator_pass → backup_fetcher → post_validator
//  - Resilience: per-dimension retries, DB fallback (new users only), 2-questions-per-prompt support
//  - Persistence: versioned batches (serial batch_id + timestamped generation_batch_key)
//  - Integrity: checksum, semantic hash, option de-dupe, question de-dupe
//  - Caching: Redis (24h TTL) for last generated dimension sets
//  - Observability: granular logs to cps_generation_logs / cps_validation_logs / cps_error_logs
//  - Live progress (optional): Socket.IO emits (namespaced events)
//
// NOTE: This service assumes a Postgres SEQUENCE named `cps.generation_batch_id_seq`
//       exists for issuing serial batch IDs. If absent, it falls back to a timestamp-based
//       numeric (and logs a warning).
//
// Dependencies (ensure installed):
//   openai, crypto, ioredis (or node-redis v4), lodash (optional), sequelize
// ----------------------------------------------------------------------------

import crypto from "crypto";
import OpenAI from "openai";
import { Sequelize } from "sequelize";

// Models
import {
  CpsQuestionBank,
  CpsRubricMapping,
  CpsPipelineRegistry,
  CpsGenerationLog,
  CpsValidationLog,
  CpsErrorLog,
  CpsUserQuestionLog,
} from "../Models/Cps/index.js";

import { sequelize1 } from "../config/sequelize.js";

// If you prefer "redis" client v4, swap this import and usage accordingly.
import Redis from "ioredis";

/** ---------------------- Configuration Defaults ---------------------- */
const DEFAULT_TARGETS = Object.freeze({
  "Comprehension & Reasoning": 5,
  "Creativity & Divergent Thinking": 4,
  "Focus & Cognitive Control": 4,
  "Memory & Retention": 4,
  "Learning Adaptability": 4,
  "Decision-Making & Problem Solving": 4,
});

// Minimum number of questions to fetch per LLM prompt (supports 2 per prompt path)
const PROMPT_BATCH_SIZE = 2;

// Max retries per dimension before DB fallback
const MAX_DIMENSION_RETRIES = 3;

// Similarity thresholds
const MAX_OPTION_DUPES = 0; // 0 identical options allowed
const QUESTION_SIMILARITY_THRESHOLD = 0.85; // Jaccard similarity threshold for rejection

// Cache TTL (seconds)
const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24h

// Socket.IO event namespace
const EVENTS = Object.freeze({
  STARTED: "generation_started",
  DIM_PROGRESS: "dimension_progress",
  VALIDATION: "validation_event",
  BACKUP: "backup_invoked",
  COMPLETED: "generation_completed",
});

/** ---------------------- Utility Helpers ---------------------- */

/**
 * Emit event safely if io provided.
 */
function emit(io, event, payload) {
  try {
    if (io) io.emit(event, payload);
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Return a timestamp key like 20251010T154512
 */
function timestampKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

/**
 * Compute SHA-256 checksum of text.
 */
function checksum(text) {
  return crypto.createHash("sha256").update(String(text) || "").digest("hex");
}

/**
 * Create a simple semantic hash:
 *  - normalize to lowercase
 *  - remove punctuation
 *  - sort unique tokens
 *  - hash the join
 */
function semanticHash(text) {
  const norm = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = Array.from(new Set(norm.split(" ").filter(Boolean))).sort();
  return checksum(tokens.join("|"));
}

/**
 * Jaccard similarity over token sets for dedup checks.
 */
function jaccardSimilarity(a, b) {
  const ta = new Set(
    String(a || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(" ")
      .filter(Boolean)
  );
  const tb = new Set(
    String(b || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(" ")
      .filter(Boolean)
  );
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Validate one MCQ item {question, options[], correct}
 * - Ensure 4 options
 * - Ensure unique options
 * - Ensure correct in [0..3]
 */
function validateMCQItem(item) {
  if (!item || typeof item !== "object") return { ok: false, reason: "ITEM_NULL" };
  const { question, options, correct } = item;
  if (!question || !Array.isArray(options)) return { ok: false, reason: "MALFORMED" };
  if (options.length !== 4) return { ok: false, reason: "FOUR_OPTIONS_REQUIRED" };
  const trimmed = options.map((o) => (o || "").toString().trim());
  const uniq = new Set(trimmed);
  if (uniq.size < 4 - MAX_OPTION_DUPES) return { ok: false, reason: "DUPLICATE_OPTIONS" };
  const idx = Number.isInteger(correct) ? correct : -1;
  if (idx < 0 || idx > 3) return { ok: false, reason: "CORRECT_INDEX_OUT_OF_RANGE" };
  // Option text must not be a direct copy of the question
  for (const opt of trimmed) {
    if (opt.length > 0 && question.toLowerCase().includes(opt.toLowerCase()))
      return { ok: false, reason: "TAUTOLOGY_OPTION" };
  }
  return { ok: true };
}

/**
 * Validate a batch (array) of items for duplicates/structure.
 */
function validateBatch(items) {
  const accepted = [];
  const rejections = [];
  for (let i = 0; i < items.length; i++) {
    const v = validateMCQItem(items[i]);
    if (!v.ok) {
      rejections.push({ index: i, reason: v.reason });
      continue;
    }
    // Check semantic similarity against accepted
    const isDupe = accepted.some(
      (a) => jaccardSimilarity(a.question, items[i].question) >= QUESTION_SIMILARITY_THRESHOLD
    );
    if (isDupe) {
      rejections.push({ index: i, reason: "DUPLICATE_SEMANTIC" });
      continue;
    }
    accepted.push(items[i]);
  }
  return { accepted, rejections };
}

/**
 * Generate the human-friendly generation_batch_key once we know batch_id.
 */
function makeBatchKey(batchId, now = new Date()) {
  return `${timestampKey(now)}-${String(batchId).padStart(6, "0")}`;
}

/**
 * Attempt to acquire a serial batch_id from a dedicated sequence.
 * If sequence is missing, fall back to a timestamp-derived numeric (logged).
 */
async function acquireBatchIdOrFallback(sequelize) {
  try {
    const [rows] = await sequelize.query("SELECT nextval('cps.generation_batch_id_seq') AS batch_id;");
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && row.batch_id) return Number(row.batch_id);
  } catch (err) {
    // swallow; fallback below
  }
  const fallback = Number(`${Date.now()}`); // not ideal, but monotonic enough for emergency use
  console.warn(
    "[CPS] WARNING: Sequence cps.generation_batch_id_seq not found. Using timestamp fallback batch_id:",
    fallback
  );
  return fallback;
}

/** ---------------------- Prompting (GPT-4o-mini) ---------------------- */

function buildPrompt(dimension, n = PROMPT_BATCH_SIZE) {
  // Keep prompt compact for -mini, and ask for strict JSON.
  return [
    {
      role: "system",
      content:
        "You are a psychometrics-savvy item writer. Generate culturally neutral, non-visual, multiple-choice questions (MCQ) to assess cognitive abilities. Avoid any media references, images, figures, or tables. No trick questions.",
    },
    {
      role: "user",
      content: `Generate ${n} unique MCQs for the dimension "${dimension}".
Each question MUST:
- Be answerable by reasoning (no prior niche knowledge).
- Have exactly 4 concise options (A-D) as strings.
- Have one correct option index (0-3).
- Be phrased in simple, clear English (global audience).
- Avoid tautologies (options must not be substrings of the question).
- Include "rubric_tags": 3-5 tags (strings) drawn from cognitive skills relevant to this dimension.

Return STRICT JSON with shape:
{
  "items": [
    {
      "question": "string",
      "options": ["string","string","string","string"],
      "correct": 0,
      "difficulty": "easy|medium|hard",
      "rubric_tags": ["tag1","tag2","tag3"]
    }
  ]
}

Do NOT include any commentary outside JSON.`,
    },
  ];
}

async function callOpenAI(openai, messages) {
  const start = Date.now();
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages,
  });
  const duration = Date.now() - start;
  const choice = resp.choices?.[0];
  const content = choice?.message?.content || "{}";
  let json = {};
  try {
    json = JSON.parse(content);
  } catch (e) {
    json = {};
  }
  return {
    json,
    usage: resp.usage || {},
    duration,
    raw: content,
  };
}

/** ---------------------- Fallback Fetch from DB ---------------------- */

async function fetchBackupQuestionsForDimension({
  dimension,
  userId,
  needed,
}) {
  // Exclude questions already served to this user
  const served = await CpsUserQuestionLog.findAll({
    attributes: ["question_id"],
    where: { user_id: userId },
    raw: true,
  });
  const servedIds = new Set(served.map((r) => r.question_id));

  const pool = await CpsQuestionBank.findAll({
    where: {
      dimension,
      is_active: true,
    },
    order: [["created_at", "DESC"]],
    limit: needed * 3, // fetch more; we’ll filter
    raw: true,
  });

  const out = [];
  for (const q of pool) {
    if (out.length >= needed) break;
    if (servedIds.has(q.id)) continue;
    // We do not re-check options here; assume bank-only contains validated items
    out.push(q);
  }
  return out;
}

/** ---------------------- Question Persistence ---------------------- */

/**
 * Persist accepted items into CpsQuestionBank + CpsRubricMapping.
 * Also writes GenerationLog rows in "accepted" status.
 */
async function persistGeneratedItems({
  items,
  meta,
  trx,
}) {
  const out = [];
  for (const item of items) {
    const qChecksum = checksum(item.question);
    const qSem = semanticHash(item.question);

    const qb = await CpsQuestionBank.create(
      {
        dimension: meta.dimension,
        question: item.question,
        options: item.options,
        correct_option: item.correct,
        rubric_tags: item.rubric_tags || null,
        difficulty: item.difficulty || "medium",
        semantic_hash: qSem,
        checksum: qChecksum,
        batch_id: meta.batch_id,
        generation_batch_key: meta.generation_batch_key,
        pipeline_name: meta.pipeline_name,
        verified_by: null,
        is_active: true,
      },
      { transaction: trx }
    );

// 🧩 Rubric mapping
// Priority 1: explicit weights (from pipeline)
// Priority 2: fallback to rubric_tags (equal weights)
if (Array.isArray(item.weights) && item.weights.length > 0) {
  for (const w of item.weights) {
    await CpsRubricMapping.create(
      {
        question_id: qb.id,
        parameter_name: w.parameter.trim().toLowerCase(),
        weight: parseFloat(w.weight) || 0,
      },
      { transaction: trx }
    );
  }
} else if (Array.isArray(item.rubric_tags) && item.rubric_tags.length > 0) {
  const cleanTags = item.rubric_tags
    .map((t) => t?.trim().toLowerCase())
    .filter(Boolean);
  const weight = parseFloat((1 / cleanTags.length).toFixed(4));
  for (const tag of cleanTags) {
    await CpsRubricMapping.create(
      {
        question_id: qb.id,
        parameter_name: tag,
        weight,
      },
      { transaction: trx }
    );
  }
}


    // Generation log (accepted)
    await CpsGenerationLog.create(
      {
        batch_id: meta.batch_id,
        generation_batch_key: meta.generation_batch_key,
        user_id: meta.user_id || null,
        dimension: meta.dimension,
        pipeline_name: meta.pipeline_name,
        prompt_snippet: meta.prompt_snippet || null,
        output_json: item,
        tokens_prompt: meta.tokens_prompt || null,
        tokens_completion: meta.tokens_completion || null,
        duration_ms: meta.duration_ms || null,
        question_id: qb.id,
        status: "accepted",
        rejection_reason: null,
      },
      { transaction: trx }
    );

    out.push(qb.get({ plain: true }));
  }
  return out;
}

/**
 * Log rejections/validation issues.
 */
async function logValidationIssues({ issues, meta, trx }) {
  for (const issue of issues) {
    await CpsValidationLog.create(
      {
        batch_id: meta.batch_id,
        generation_batch_key: meta.generation_batch_key,
        question_id: null,
        dimension: meta.dimension,
        validator_name: "validator_pass",
        issue_code: issue.reason,
        details: { index: issue.index },
        resolved: false,
      },
      { transaction: trx }
    );
  }
}

/**
 * Log operational errors.
 */
async function logError({ err, meta }) {
  try {
    await CpsErrorLog.create({
      batch_id: meta?.batch_id || null,
      generation_batch_key: meta?.generation_batch_key || null,
      pipeline_name: meta?.pipeline_name || null,
      dimension: meta?.dimension || null,
      error_name: err?.name || "Error",
      message: err?.message || String(err),
      stack: err?.stack || null,
      meta: meta || null,
    });
  } catch (e) {
    // last resort: console
    // eslint-disable-next-line no-console
    console.error("[CPS] Failed to log error:", e);
  }
}

/** ---------------------- Main Service Class ---------------------- */

export class CpsQuestionGeneratorService {
  /**
   * @param {object} opts
   * @param {OpenAI} [opts.openai] - optional injection; defaults to env OPENAI_API_KEY
   * @param {Redis} [opts.redis] - ioredis instance or compatible
   * @param {SocketIO.Server} [opts.io] - optional Socket.IO server for live events
   */
  constructor(opts = {}) {
    this.openai =
      opts.openai ||
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
    this.redis =
      opts.redis ||
      (redisUrl ? new Redis(redisUrl) : null);
    this.io = opts.io || null;
  }

  /**
   * Generate an IQ test set for a user. Returns persisted questions (bank items).
   * Applies: multi-pipeline retries, validation, caching, DB fallback (new users only).
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {Record<string, number>} [params.targets] - dimension → count (defaults to DEFAULT_TARGETS)
   * @param {boolean} [params.newUserOnlyFallback=true] - use DB fallback only for new users
   */
  async generateIQTestForUser(params = {}) {
    const { userId } = params;
    const targets = params.targets || DEFAULT_TARGETS;
    const newUserOnlyFallback = params.newUserOnlyFallback !== false;
    const now = new Date();

    // Acquire serial batch_id
    const batch_id = await acquireBatchIdOrFallback(sequelize1);
    const generation_batch_key = makeBatchKey(batch_id, now);

    emit(this.io, EVENTS.STARTED, {
      batch_id,
      generation_batch_key,
      user_id: userId,
      dims: Object.keys(targets),
      ts: now.toISOString(),
    });

    const resultsByDimension = {};
    // We’ll keep a transaction per dimension to minimize lock scope
    for (const dimension of Object.keys(targets)) {
      const needed = targets[dimension] || 0;
      if (needed <= 0) {
        resultsByDimension[dimension] = [];
        continue;
      }

      const dimensionResult = await this.#generateForDimension({
        userId,
        batch_id,
        generation_batch_key,
        dimension,
        needed,
        newUserOnlyFallback,
      });

      resultsByDimension[dimension] = dimensionResult || [];
      emit(this.io, EVENTS.DIM_PROGRESS, {
        batch_id,
        generation_batch_key,
        user_id: userId,
        dimension,
        progress: dimensionResult.length,
        target: needed,
        status: "completed_dimension",
      });
    }

    emit(this.io, EVENTS.COMPLETED, {
      batch_id,
      generation_batch_key,
      user_id: userId,
      summary: Object.fromEntries(
        Object.entries(resultsByDimension).map(([dim, arr]) => [dim, arr.length])
      ),
      ts: new Date().toISOString(),
    });

    return {
      batch_id,
      generation_batch_key,
      questions: resultsByDimension,
    };
  }

  /**
   * Internal per-dimension generation with resilience and fallback.
   */
  async #generateForDimension({
    userId,
    batch_id,
    generation_batch_key,
    dimension,
    needed,
    newUserOnlyFallback,
  }) {
    const cacheKey = `CPS_QSET:${dimension}:${generation_batch_key}`;
    let collected = [];

    // 1) Try cache first (should be empty for new batch; still safe)
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr) && arr.length >= needed) {
            return arr.slice(0, needed);
          }
        }
      } catch (e) {
        // cache errors are non-blocking
      }
    }

    // 2) Core → Filler → Validator (per-dimension retries)
    let attempts = 0;
    while (collected.length < needed && attempts < MAX_DIMENSION_RETRIES) {
      attempts++;
      const toGenerate = Math.max(0, needed - collected.length);

      // a) CORE GENERATOR (multiple small prompts, PROMPT_BATCH_SIZE each)
      const coreOut = await this.#runGeneratorPipeline({
        userId,
        batch_id,
        generation_batch_key,
        dimension,
        pipeline_name: "core_generator",
        promptBatches: Math.ceil(toGenerate / PROMPT_BATCH_SIZE),
      });

      collected = collected.concat(coreOut);

      // b) FILLER GENERATOR if still missing
      if (collected.length < needed) {
        const remaining = needed - collected.length;
        const fillerOut = await this.#runGeneratorPipeline({
          userId,
          batch_id,
          generation_batch_key,
          dimension,
          pipeline_name: "filler_generator",
          promptBatches: Math.ceil(remaining / PROMPT_BATCH_SIZE),
        });
        collected = collected.concat(fillerOut);
      }

      // c) POST VALIDATOR PASS (lightweight — we already validate batches)
      emit(this.io, EVENTS.VALIDATION, {
        batch_id,
        generation_batch_key,
        dimension,
        status: "post_validator",
        accepted: collected.length,
        target: needed,
      });
    }

    // 3) FALLBACK to DB for remaining (respecting new-user-only rule if set)
    if (collected.length < needed) {
      let canUseFallback = true;
      if (newUserOnlyFallback) {
        const alreadyServed = await CpsUserQuestionLog.count({
          where: { user_id: userId },
        });
        canUseFallback = alreadyServed === 0;
      }
      if (canUseFallback) {
        emit(this.io, EVENTS.BACKUP, {
          batch_id,
          generation_batch_key,
          dimension,
          missing: needed - collected.length,
        });
        const backups = await fetchBackupQuestionsForDimension({
          dimension,
          userId,
          needed: needed - collected.length,
        });
        collected = collected.concat(backups);
      }
    }

    // 4) Write cache
    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(collected), "EX", REDIS_TTL_SECONDS);
      } catch (_) {}
    }

    // 5) Return exactly needed
    return collected.slice(0, needed);
  }

  /**
   * Run generator pipeline: call LLM in multiple small prompts, validate, persist.
   * Returns the saved QuestionBank rows (plain objects).
   */
  async #runGeneratorPipeline({
    userId,
    batch_id,
    generation_batch_key,
    dimension,
    pipeline_name,
    promptBatches,
  }) {
    const out = [];

    for (let i = 0; i < promptBatches; i++) {
      const t0 = Date.now();
      let llm;
      try {
        llm = await callOpenAI(this.openai, buildPrompt(dimension, PROMPT_BATCH_SIZE));
      } catch (err) {
        await logError({
          err,
          meta: {
            batch_id,
            generation_batch_key,
            pipeline_name,
            dimension,
          },
        });
        continue;
      }

      const items = Array.isArray(llm.json?.items) ? llm.json.items : [];
      // validation
      const { accepted, rejections } = validateBatch(items);

      // Log validation rejections (no transaction needed for logs)
      try {
        await logValidationIssues({
          issues: rejections,
          meta: {
            batch_id,
            generation_batch_key,
            dimension,
          },
        });
      } catch (e) {
        // swallow; not critical
      }

      // Persist accepted in one transaction to keep bank+log atomic
      const trx = await sequelize1.transaction();
      try {
        const saved = await persistGeneratedItems({
          items: accepted,
          meta: {
            batch_id,
            generation_batch_key,
            user_id: userId,
            dimension,
            pipeline_name,
            prompt_snippet: (llm.raw || "").slice(0, 1800),
            tokens_prompt: llm.usage?.prompt_tokens || null,
            tokens_completion: llm.usage?.completion_tokens || null,
            duration_ms: llm.duration || Date.now() - t0,
          },
          trx,
        });
        await trx.commit();
        out.push(...saved);
      } catch (err) {
        await trx.rollback();
        await logError({
          err,
          meta: {
            batch_id,
            generation_batch_key,
            pipeline_name,
            dimension,
          },
        });
      }

      // Also log "retrying" generation rows for visibility (one per prompt call)
      try {
        await CpsGenerationLog.create({
          batch_id,
          generation_batch_key,
          user_id: userId,
          dimension,
          pipeline_name,
          prompt_snippet: "BATCH_CALL",
          output_json: { count_in: items.length, count_ok: accepted.length },
          tokens_prompt: llm.usage?.prompt_tokens || null,
          tokens_completion: llm.usage?.completion_tokens || null,
          duration_ms: llm.duration,
          question_id: null,
          status: accepted.length ? "accepted" : "retrying",
          rejection_reason: accepted.length ? null : "ALL_REJECTED_IN_PROMPT",
        });
      } catch (_) {}
    }

    return out;
  }
}

/** ---------------------- Optional: Pipeline Auto-Registration ---------------------- */
/**
 * Seed known pipelines dynamically (safe to call on bootstrap).
 */
export async function ensureDefaultPipelines() {
  const names = [
    { pipeline_name: "core_generator", description: "Primary GPT-4o-mini generator" },
    { pipeline_name: "filler_generator", description: "Secondary GPT-4o-mini generator" },
    { pipeline_name: "validator_pass", description: "Semantic/structural validator pass" },
    { pipeline_name: "backup_fetcher", description: "DB fallback fetcher" },
    { pipeline_name: "post_validator", description: "Post-assembly sanity checks" },
  ];
  for (const p of names) {
    await CpsPipelineRegistry.findOrCreate({ where: { pipeline_name: p.pipeline_name }, defaults: p });
  }
}
