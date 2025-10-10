// src/services/cps/cpsEma.service.js
import { sequelize1 } from "../../config/sequelize.js";
import { Test } from "../../Models/test.model.js";
import { CpsProfile } from "../../Models/CpsProfile.model.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { CPS_KEYS } from "./cpsKeys.js";

/* -------------------------------------------------------------------------- */
/*                                UTIL HELPERS                                */
/* -------------------------------------------------------------------------- */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp100 = (x) => Math.max(0, Math.min(100, x));
const asNum = (v) => (v === null || v === undefined ? undefined : Number(v));

/**
 * Extract CPS deltas from explicit args or from test row.
 */
function pickCpsDeltas({ deltas, test }) {
  if (deltas && typeof deltas === "object" && Object.keys(deltas).length > 0) {
    return deltas;
  }
  if (test?.performance_metrics?.param_deltas) {
    return test.performance_metrics.param_deltas;
  }
  if (test?.performance_metrics?.cps_scores) {
    return test.performance_metrics.cps_scores;
  }
  if (test?.result?.cps_scores) {
    return test.result.cps_scores;
  }
  return {};
}

/**
 * Resolve the root domain node_id for a topic.
 * Walks up parent chain until a domain node is found.
 */
async function getDomainIdForTopic(topicId, transaction) {
  let node = await CatalogueNode.findByPk(topicId, { transaction });
  while (node && node.parent_id) {
    if (node.node_type === "domain") return node.node_id;
    node = await CatalogueNode.findByPk(node.parent_id, { transaction });
  }
  return node?.node_id || null;
}

/* -------------------------------------------------------------------------- */
/*                        EXPONENTIAL MOVING AVERAGE                           */
/* -------------------------------------------------------------------------- */
/**
 * Update the appropriate CPS profile from one evaluated test.
 *
 * Behaviour:
 *  - Determines whether test is IQ or Domain-based
 *  - Creates / updates the correct CpsProfile row
 *  - Applies EMA per CPS key
 */
export async function updateCpsProfileFromTest({
  testId,
  userId,
  deltas, // direct deltas (preferred)
  alpha = 0.4,
  firstTestSetsBaseline = true,
} = {}) {
  if (!testId) throw new Error("updateCpsProfileFromTest: testId is required");
  const effAlpha = clamp01(alpha);

  return sequelize1.transaction(async (t) => {
    /* ------------------------- Load test + sanity check ------------------------- */
    const test = await Test.findByPk(testId, { transaction: t });
    if (!test) throw new Error(`Test ${testId} not found`);

    const uid = userId || test.user_id;
    if (!uid) throw new Error("Cannot resolve user_id for CPS update");

    const incoming = pickCpsDeltas({ deltas, test });
    console.log("🔍 [CPS-EMA] Incoming deltas for user", uid, "→", incoming);

    /* ----------------------------- Determine context ---------------------------- */
    let context_type = "IQ";
    let context_ref_id = null;

    // Identify test type
    const isIQ = test.is_iq_test || test.test_type === "IQ";
    if (!isIQ && test.topic_id) {
      const domainId = await getDomainIdForTopic(test.topic_id, t);
      if (domainId) {
        context_type = "DOMAIN";
        context_ref_id = domainId;
      }
    }

    console.log(
      `🧩 [CPS-EMA] Context resolved → type=${context_type}, ref=${context_ref_id || "NULL"}`
    );

    /* ------------------------- Ensure profile row exists ------------------------ */
    const [profile] = await CpsProfile.findOrCreate({
      where: { user_id: uid, context_type, context_ref_id },
      defaults: {
        user_id: uid,
        context_type,
        context_ref_id,
        tests_seen: 0,
      },
      transaction: t,
    });

    const testsSeen = Number(profile.tests_seen || 0);
    const updated = {};
    let updatedCount = 0;

    /* -------------------------- Apply EMA per parameter ------------------------- */
    for (const key of CPS_KEYS) {
      const latestRaw = asNum(incoming[key]);
      const latest = Number.isFinite(latestRaw) ? clamp100(latestRaw) : 0;

      const prev = asNum(profile[key]);
      if (testsSeen === 0 && firstTestSetsBaseline) {
        // First test sets baseline
        updated[key] = latest;
      } else {
        // EMA smoothing
        const base = Number.isFinite(prev) ? Number(prev) : 0;
        const ema = (1 - effAlpha) * base + effAlpha * latest;
        updated[key] = clamp100(ema);
      }
      updatedCount++;
    }

    const nextSeen = testsSeen + 1;

    console.log(
      `✅ [CPS-EMA] Updating profile for user=${uid} (${context_type}) → ${updatedCount} keys`
    );

    await profile.update(
      { ...updated, tests_seen: nextSeen, last_test_id: test.test_id },
      { transaction: t }
    );

    /* --------------------------- Mark test metadata ---------------------------- */
    const result = { ...(test.result || {}) };
    result.cps_ema = {
      applied: true,
      alpha: effAlpha,
      context_type,
      context_ref_id,
      tests_seen_before: testsSeen,
      tests_seen_after: nextSeen,
      updated_keys: updatedCount,
      applied_at: new Date().toISOString(),
    };
    await test.update({ result }, { transaction: t });

    /* ------------------------------- Return info ------------------------------- */
    return {
      applied: true,
      user_id: uid,
      test_id: test.test_id,
      context_type,
      context_ref_id,
      alpha: effAlpha,
      tests_seen_before: testsSeen,
      tests_seen_after: nextSeen,
      updated_keys: updatedCount,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                     PURE UTILITY — ONE-PARAMETER EMA                       */
/* -------------------------------------------------------------------------- */
export function ema(prev, latest, alpha = 0.4) {
  const A = clamp01(alpha);
  if (!Number.isFinite(prev)) return clamp100(latest);
  return clamp100((1 - A) * prev + A * latest);
}
