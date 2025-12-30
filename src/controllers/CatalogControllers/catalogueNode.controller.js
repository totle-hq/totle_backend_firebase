// src/controllers/CatalogControllers/catalogueNode.controller.js
import { Op } from "sequelize";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { redisClient } from "../../config/redis.js";

/* ------------------------------------------------------------------
   Cache helpers (same pattern you already had)
------------------------------------------------------------------- */
const inMemoryCache = new Map();
const CACHE_TTL = 300;

async function cacheGet(key) {
  try { const v = await redisClient.get(key); if (v) return JSON.parse(v); } catch {}
  return inMemoryCache.get(key);
}
async function cacheSet(key, data) {
  try { await redisClient.set(key, JSON.stringify(data), "EX", CACHE_TTL); }
  catch { inMemoryCache.set(key, data); setTimeout(() => inMemoryCache.delete(key), CACHE_TTL * 1000); }
}
async function cacheDel(pattern) {
  try { const keys = await redisClient.keys(pattern); for (const k of keys) await redisClient.del(k); }
  catch { inMemoryCache.clear(); }
}

/* ------------------------------------------------------------------
   Address helpers (existing)
------------------------------------------------------------------- */
const buildAddressOfNode = async (node) => {
  const names = [];
  let current = node;
  while (current) {
    names.unshift(current.name);
    if (!current.parent_id) break;
    current = await CatalogueNode.findByPk(current.parent_id);
  }
  return names.join(" → ");
};
const updateAddressRecursively = async (node) => {
  const address = await buildAddressOfNode(node);
  await node.update({ address_of_node: address });
  const children = await CatalogueNode.findAll({ where: { parent_id: node.node_id } });
  for (const child of children) await updateAddressRecursively(child);
};

/* ------------------------------------------------------------------
   Price distribution (existing)
------------------------------------------------------------------- */
const findUniformDomainParent = async (node) => {
  if (node?.is_domain && node.metadata?.uniform) return node;
  if (!node?.parent_id) return null;
  const parent = await CatalogueNode.findByPk(node.parent_id);
  if (!parent) return null;
  if (parent.is_domain && parent.metadata?.uniform) return parent;
  return await findUniformDomainParent(parent);
};
async function distributePricesRecursively(parentId, prices) {
  const children = await CatalogueNode.findAll({ where: { parent_id: parentId } });
  if (!children.length) return;

  const keys = ["bridgers", "experts", "masters", "legends"];
  const matrix = {};
  for (const k of keys) {
    const total = prices[k] || 0;
    const avg = Math.floor(total / children.length);
    const rem = total - avg * children.length;
    matrix[k] = Array(children.length).fill(avg);
    for (let i = 0; i < rem; i++) matrix[k][i] += 1;
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childPrices = {}; for (const k of keys) childPrices[k] = matrix[k][i];
    await child.update({ prices: childPrices });
    await distributePricesRecursively(child.node_id, childPrices);
  }
  const fresh = await CatalogueNode.findAll({ where: { parent_id: parentId } });
  await cacheSet(`catalogue:children:${parentId}`, fresh);
}

/* ------------------------------------------------------------------
   CPS presets & math
------------------------------------------------------------------- */
const ARCH = {
  RecallHeavy:       { reasoning:.3, memory:.9, speed:.2, attention:.3, metacognition:.2, resilience:.2, teacher_score: .2, },
  ProofDerivation:   { reasoning:.9, memory:.3, speed:.2, attention:.4, metacognition:.5, resilience:.5, teacher_score: .85 },
  ProcedureExec:     { reasoning:.5, memory:.6, speed:.4, attention:.3, metacognition:.3, resilience:.3, teacher_score: .45 },
  ConceptBuild:      { reasoning:.7, memory:.5, speed:.3, attention:.4, metacognition:.4, resilience:.35, teacher_score: .7 },
  CaseAnalysis:      { reasoning:.7, memory:.45, speed:.3, attention:.6, metacognition:.5, resilience:.4, teacher_score: .75 },
  Synthesis:         { reasoning:.75, memory:.55, speed:.35, attention:.5, metacognition:.55, resilience:.5, teacher_score: .9 },
  FormulaDrill:      { reasoning:.45, memory:.65, speed:.5, attention:.3, metacognition:.25, resilience:.3, teacher_score: .35 },
};
const ZERO7 = { reasoning:0, memory:0, speed:0, attention:0, metacognition:0, resilience:0, teacher_score:0 };

const s = (x) => (x == null ? 0 : Math.max(0, Math.min(1, (x - 1) / 4))); // 1..5 -> 0..1
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function H_fromTopic(t) {
  const complexity = s(t.complexity_level);
  const engage    = s(t.engagement_factor);
  const retain    = s(t.retention_importance);
  const cross     = s(t.cross_domain_relevance);
  const curve     = s(t.typical_learning_curve);
  const depth     = s(t.depth_requirement);
  const app = t.application_type;

  const I = (cond) => (cond ? 1 : 0);

  const reasoning =
    0.45*depth + 0.35*complexity + 0.20*I(app === "conceptual" || app === "applied");
  const memory =
    0.60*retain + 0.25*I(app === "procedural") + 0.15*depth;
  const speed =
    0.55*(1 - depth) + 0.45*engage;
  const attention =
    0.40*complexity + 0.40*(1 - engage) + 0.20*cross;
  const metacognition =
    0.60*curve + 0.40*I(app === "meta");
  const resilience =
    0.55*complexity + 0.45*curve;
  const teacher_score =
    0.25 * retain +
    0.20 * engage +
    0.20 * complexity +
    0.20 * depth +
    0.15 * I(app === "conceptual" || app === "meta");

  const raw = { reasoning, memory, speed, attention, metacognition, resilience, teacher_score };
  // clamp+normalize by max (keeps shape)
  const maxv = Math.max(...Object.values(raw), 1e-9);
  const norm = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k, clamp01(v / maxv)]));
  return norm;
}

function blendVectors({ D = ZERO7, H = ZERO7, A = ZERO7, wD = 0.3, wH = 0.4, wA = 0.3 }) {
  const keys = Object.keys(ZERO7);
  const raw = {};
  for (const k of keys) raw[k] = (wD * (D[k] ?? 0)) + (wH * (H[k] ?? 0)) + (wA * (A[k] ?? 0));
  const maxv = Math.max(...Object.values(raw), 1e-9);
  const final = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k, clamp01(v / maxv)]));
  return final;
}

function recommendItemMix(final) {
  // 25 cognitive items
  const keys = Object.keys(final).filter(k => k !== "teacher_score");
  const sum = keys.reduce((a,k)=>a+(final[k]||0),0) || 1;
  const ideal = keys.map(k => ({ k, v: (final[k]||0) / sum * 20 }));
  const floor = ideal.map(x => ({ k: x.k, n: Math.floor(x.v) }));
  let used = floor.reduce((a,x)=>a+x.n,0);
  const remList = ideal
    .map((x,i)=>({ i, k:x.k, r: x.v - floor[i].n }))
    .sort((a,b)=>b.r - a.r);
  for (let j=0; used<20 && j<remList.length; j++) {
    floor[remList[j].i].n += 1; used += 1;
  }
  // optional: min 1 for any dim > .15
  for (const f of floor) {
    if (final[f.k] > 0.15 && f.n === 0) { f.n = 1; }
  }
  // re-adjust if >20 (rare after min)
  let total = floor.reduce((a,x)=>a+x.n,0);
  if (total > 20) {
    floor.sort((a,b)=>b.n - a.n);
    let idx = 0;
    while (total>25 && idx<floor.length) { if (floor[idx].n>0){ floor[idx].n--; total--; } idx++; }
  }
  const mix = Object.fromEntries(floor.map(f => [f.k, f.n]));
  mix.teacher_score = 5;   // FIXED VALUE
  return mix;
}

function recommendTimePressure(final, topic) {
  const sp = final.speed || 0;
  const depth = s(topic.depth_requirement);
  let pr = sp >= 0.6 ? "high" : (sp >= 0.35 ? "medium" : "low");
  // reduce pressure when depth is high (avoid construct confound)
  if (depth >= 0.6 && pr === "high") pr = "medium";
  return pr;
}

const getArchetypePreset = (arch) => ARCH[arch] || ZERO7;

/* ------------------------------------------------------------------
   Tree helpers
------------------------------------------------------------------- */
async function findDomainAncestor(node) {
  let cur = node;
  while (cur) {
    if (cur.is_domain) return cur;
    if (!cur.parent_id) break;
    cur = await CatalogueNode.findByPk(cur.parent_id);
  }
  return null;
}

async function listDescendantsBFS(rootId) {
  const result = [];
  const queue = [rootId];
  while (queue.length) {
    const pid = queue.shift();
    const children = await CatalogueNode.findAll({ where: { parent_id: pid } });
    for (const c of children) {
      result.push(c);
      queue.push(c.node_id);
    }
  }
  return result;
}

/* ------------------------------------------------------------------
   Core: recompute a topic's CPS computed fields (persist)
------------------------------------------------------------------- */
async function recomputeTopicComputedFields(topic) {
  const domain = await findDomainAncestor(topic);
  const D = domain?.domain_cognitive_profile || ZERO7;
  const H = H_fromTopic(topic);
  const A = getArchetypePreset(topic.archetype);
  const final = blendVectors({ D, H, A, wD:0.3, wH:0.4, wA:0.3 });
  const mix = recommendItemMix(final);
  const tp = recommendTimePressure(final, topic);

  await topic.update({
    computed_cps_weights: final,
    recommended_item_mix: mix,
    recommended_time_pressure: tp,
  });
  await cacheDel(`catalogue:node:${topic.node_id}`);
  return topic;
}

/* ==================================================================
   CRUD: Existing + CPS extensions
================================================================== */

/* ---------- Create node (backward compatible) ---------- */
export const createNode = async (req, res) => {
  try {
    const node = await CatalogueNode.create(req.body);
    const fullNode = await CatalogueNode.findByPk(node.node_id);
    await updateAddressRecursively(fullNode);

    await cacheDel(`catalogue:children:${node.parent_id}*`);
    await cacheDel(`catalogue:domains*`);

    const domainNode = await findUniformDomainParent(node);
    console.log("domain node", domainNode)
    if (domainNode?.prices) {
      if(domainNode?.metadata?.uniform){
        console.log("domain", domainNode?.metadata?.uniform);
        await distributePricesRecursively(domainNode.node_id, domainNode.prices);
      }
    }
    // If topic, compute CPS now (only if typed fields present)
    if (fullNode.is_topic && fullNode.archetype) {
      await recomputeTopicComputedFields(fullNode);
    }

    return res.status(201).json(fullNode);
  } catch (err) {
    console.error("Error creating node:", err);
    return res.status(400).json({ error: err.message });
  }
};

// One-time fix to update teacher_score of all existing topic nodes
export const patchAllTopicTeacherScores = async (_req, res) => {
  try {
    const topics = await CatalogueNode.findAll({
      where: { is_topic: true }
    });

    const updatedNodes = [];
    const skippedNodes = [];

    for (const topic of topics) {
      const weights = topic.computed_cps_weights || {};

      if (weights.teacher_score === undefined || weights.teacher_score === null) {
        weights.teacher_score = 5;

        await topic.update({ computed_cps_weights: weights });

        updatedNodes.push({
          id: topic.id,
          address: topic.address,
          name: topic.name,
          updated_teacher_score: 5
        });
      } else {
        skippedNodes.push({
          id: topic.id,
          address: topic.address,
          name: topic.name,
          existing_teacher_score: weights.teacher_score
        });
      }
    }

    return res.json({
      message: "🎯 Teacher scores patch operation completed",
      total_updated: updatedNodes.length,
      total_skipped: skippedNodes.length,
      updated_nodes: updatedNodes,
      skipped_nodes: skippedNodes
    });

  } catch (err) {
    console.error("❌ Error patching teacher scores:", err);
    return res.status(500).json({ error: err.message });
  }
};


/* ---------- Get node by ID (existing) ---------- */
export const getNodeById = async (req, res) => {
  const key = `catalogue:node:${req.params.id}`;
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);
  try {
    const node = await CatalogueNode.findByPk(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });
    await cacheSet(key, node);
    return res.json(node);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* ---------- Children OR domains list ---------- */
export const getChildren = async (req, res) => {
  const { parent_id: parentIdRaw, is_domain, type } = req.query;

  // explicit domains list:
  if (String(is_domain).toLowerCase() === "true" || String(type).toLowerCase() === "domain") {
    const key = `catalogue:domains`;
    const cached = await cacheGet(key);
    if (cached) return res.json(cached);
    try {
      const rows = await CatalogueNode.findAll({
        where: { is_domain: true },
        order: [["created_at", "ASC"]],
      });
      await cacheSet(key, rows);
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const parentId = parentIdRaw || null;
  const key = `catalogue:children:${parentId}`;
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const children = await CatalogueNode.findAll({
      where: { parent_id: parentId },
      order: [["created_at", "ASC"]],
    });
    await cacheSet(key, children);
    return res.json(children);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* ---------- NEW: explicit domains ---------- */
export const getDomains = async (_req, res) => {
  const key = `catalogue:domains`;
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);
  try {
    const rows = await CatalogueNode.findAll({
      where: { is_domain: true },
      order: [["created_at", "ASC"]],
    });
    await cacheSet(key, rows);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* ---------- Update node (back-compat) + CPS hooks ---------- */
export const updateNode = async (req, res) => {
  try {
    const node = await CatalogueNode.findByPk(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });

    await node.update(req.body);

    const updated = await CatalogueNode.findByPk(node.node_id);
    await updateAddressRecursively(updated);

    await cacheDel(`catalogue:node:${req.params.id}`);
    await cacheDel(`catalogue:children:${node.parent_id}*`);
    await cacheDel(`catalogue:domains*`);

    const domainNode = await findUniformDomainParent(updated);
    if (domainNode?.prices) {
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }

    // Recompute for topics when typed fields/archetype changed
    if (updated.is_topic) {
      await recomputeTopicComputedFields(updated);
    }

    // ✅ BUGFIX: return the updated record (not the function)
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/* ---------- Safe delete (existing) ---------- */
export const deleteNode = async (req, res) => {
  try {
    const node = await CatalogueNode.findByPk(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });

    const hasChild = await CatalogueNode.findOne({ where: { parent_id: node.node_id } });
    if (hasChild) return res.status(400).json({ error: "Node has children, cannot delete" });

    const parent = node.parent_id ? await CatalogueNode.findByPk(node.parent_id) : null;

    await node.destroy();
    await cacheDel(`catalogue:node:${req.params.id}`);
    await cacheDel(`catalogue:children:${node.parent_id}*`);
    await cacheDel(`catalogue:domains*`);

    const domainNode = await findUniformDomainParent(parent);
    if (domainNode?.prices) {
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }

    return res.json({ message: "Node deleted" });
  } catch (err) {
    console.error("Error deleting node:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* ---------- Counts (existing) ---------- */
export const getDomainCount = async (_req, res) => {
  try {
    const domainCount = await CatalogueNode.count({ where: { is_domain: true } });
    return res.json({ count: domainCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
export const getTopicCount = async (_req, res) => {
  try {
    const topicCount = await CatalogueNode.count({ where: { is_topic: true } });
    return res.json({ count: topicCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* ==================================================================
   CPS-aware: Domains
================================================================== */

export const updateDomain = async (req, res) => {
  try {
    const dom = await CatalogueNode.findByPk(req.params.id);
    if (!dom || !dom.is_domain) return res.status(404).json({ error: "Domain not found" });

    const allowed = [
      "domain_cognitive_profile", "modality_mix", "knowledge_type_mix",
      "domain_observed_pull_vector", "metadata", "prices", "status"
    ];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    await dom.update(patch);

    // src/controllers/CatalogControllers/catalogueNode.controller.js
if (dom.metadata?.uniform && dom.prices) {
  await distributePricesRecursively(dom.node_id, dom.prices);
}


    await cacheDel(`catalogue:node:${dom.node_id}`);
    await cacheDel(`catalogue:domains*`);

    return res.json(dom);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Recompute all descendant topics under a domain (BFS)
export const recomputeDomainTopics = async (req, res) => {
  try {
    const dom = await CatalogueNode.findByPk(req.params.id);
    if (!dom || !dom.is_domain) return res.status(404).json({ error: "Domain not found" });

    const nodes = await listDescendantsBFS(dom.node_id);
    let count = 0;
    for (const n of nodes) {
      if (n.is_topic && n.archetype) {
        await recomputeTopicComputedFields(n);
        count++;
      }
    }
    return res.json({ message: "Recomputed topics", count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* ==================================================================
   CPS-aware: Topics
================================================================== */

export const getTopicById = async (req, res) => {
  try {
    const t = await CatalogueNode.findByPk(req.params.id);
    if (!t || !t.is_topic) return res.status(404).json({ error: "Topic not found" });
    return res.json(t);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createTopic = async (req, res) => {
  try {
    const payload = { ...req.body, is_topic: true, is_domain: false, is_subject: false };
    const t = await CatalogueNode.create(payload);
    const full = await CatalogueNode.findByPk(t.node_id);
    await updateAddressRecursively(full);
    await recomputeTopicComputedFields(full);
    const domainNode = await findUniformDomainParent(full);
    if (domainNode?.metadata?.uniform && domainNode.prices) {
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }
    await cacheDel(`catalogue:children:${full.parent_id}*`);
    return res.status(201).json(full);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const updateTopic = async (req, res) => {
  try {
    const t = await CatalogueNode.findByPk(req.params.id);
    if (!t || !t.is_topic) return res.status(404).json({ error: "Topic not found" });

    await t.update(req.body);
    const full = await CatalogueNode.findByPk(t.node_id);
    await recomputeTopicComputedFields(full);

    await cacheDel(`catalogue:node:${t.node_id}`);
    await cacheDel(`catalogue:children:${t.parent_id}*`);

    return res.json(full);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const recomputeTopic = async (req, res) => {
  try {
    const t = await CatalogueNode.findByPk(req.params.id);
    if (!t || !t.is_topic) return res.status(404).json({ error: "Topic not found" });
    await recomputeTopicComputedFields(t);
    return res.json(t);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/* ==================================================================
   Generator input & Telemetry
================================================================== */

export const getGeneratorInput = async (req, res) => {
  try {
    const t = await CatalogueNode.findByPk(req.params.topicId);
    if (!t || !t.is_topic) return res.status(404).json({ error: "Topic not found" });

    const topParams = Array.isArray(t.metadata?.top_cps_parameters) ? t.metadata.top_cps_parameters.slice(0,2) : [];
    const styles    = Array.isArray(t.metadata?.preferred_item_styles) ? t.metadata.preferred_item_styles.slice(0,3) : [];

    return res.json({
      topic_id: t.node_id,
      final_weights: t.computed_cps_weights,
      item_mix: t.recommended_item_mix,
      time_pressure: t.recommended_time_pressure,
      top_cps_parameters: topParams,
      preferred_item_styles: styles,
      session_count: t.session_count ?? 1,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Minimal telemetry EMA update
export const ingestTopicTelemetry = async (req, res) => {
  try {
    const t = await CatalogueNode.findByPk(req.params.id);
    if (!t || !t.is_topic) return res.status(404).json({ error: "Topic not found" });

    const observed = req.body?.observed_pull_vector; // same 6-d shape
    const alpha = typeof req.body?.alpha === "number" ? Math.max(0, Math.min(1, req.body.alpha)) : 0.2;

    if (observed && typeof observed === "object") {
      const current = t.topic_observed_pull_vector || ZERO7;
      const next = {};
      for (const k of Object.keys(ZERO7)) {
        const o = Number(observed[k] ?? 0);
        next[k] = clamp01((1 - alpha) * (Number(current[k] ?? 0)) + alpha * o);
      }
      await t.update({ topic_observed_pull_vector: next, last_telemetry_update: new Date() });
      // Optionally nudge computed weights a little… (kept separate as per notes)
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ---------- Subtopics (KEPT & EXPORTED) ----------
export const addSubtopics = async (req, res) => {
  try {
    const topic = await CatalogueNode.findByPk(req.params.id);
    if (!topic || !topic.is_topic) {
      return res.status(400).json({ error: "Invalid topic node" });
    }

    const subtopics = req.body.subtopics || [];
    if (!Array.isArray(subtopics) || subtopics.length === 0) {
      return res.status(400).json({ error: "Subtopics must be a non-empty array" });
    }

    const enriched = subtopics.map((s) => ({
      name: s.name,
      parent_id: topic.node_id,
      node_level: `${topic.node_level || "topic"}_subtopic`,
      metadata: { is_subtopic: true },
    }));

    const created = await CatalogueNode.bulkCreate(enriched);
    await cacheDel(`catalogue:children:${topic.node_id}*`);
    return res.status(201).json({ message: "Subtopics added successfully", subtopics: created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getSubtopics = async (req, res) => {
  try {
    const topicId = req.params.id;

    const subtopics = await CatalogueNode.findAll({
      where: {
        parent_id: topicId,
        node_level: { [Op.like]: "%_subtopic" },
        // NOTE: this works in Sequelize for top-level JSONB match;
        // if your PG/Sequelize combo needs explicit JSON path, we can switch to sequelize.where(json('metadata.is_subtopic'), true)
        metadata: { is_subtopic: true },
      },
      order: [["created_at", "ASC"]],
    });

    return res.json(subtopics);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateSubtopic = async (req, res) => {
  try {
    const subtopic = await CatalogueNode.findByPk(req.params.subtopic_id);
    if (!subtopic || subtopic.metadata?.is_subtopic !== true) {
      return res.status(404).json({ error: "Subtopic not found" });
    }

    await subtopic.update(req.body);
    await cacheDel(`catalogue:children:${subtopic.parent_id}*`);
    return res.json(subtopic);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteSubtopic = async (req, res) => {
  try {
    const subtopic = await CatalogueNode.findByPk(req.params.subtopic_id);
    if (!subtopic || subtopic.metadata?.is_subtopic !== true) {
      return res.status(404).json({ error: "Subtopic not found" });
    }

    await subtopic.destroy();
    await cacheDel(`catalogue:children:${subtopic.parent_id}*`);
    return res.json({ message: "Subtopic deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ---------- Breadcrumbs (KEPT & EXPORTED) ----------
export const getBreadcrumb = async (req, res) => {
  try {
    const trail = [];
    let current = await CatalogueNode.findByPk(req.params.id);
    while (current) {
      trail.unshift(current);
      if (!current.parent_id) break;
      current = await CatalogueNode.findByPk(current.parent_id);
    }
    return res.json(trail);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const insertNodeBetween = async (req, res) => {
  const { parentId, childId, newNode } = req.body;

  if (!parentId || !childId || !newNode?.name) {
    return res.status(400).json({ error: 'parentId, childId and newNode.name are required' });
  }

  try {
    const parentNode = await CatalogueNode.findByPk(parentId);
    const childNode = await CatalogueNode.findByPk(childId);

    if (!parentNode || !childNode) {
      return res.status(404).json({ error: 'Parent or Child node not found' });
    }

    if (childNode.parent_id !== parentId) {
      return res.status(400).json({ error: 'The given child is not currently a child of the given parent' });
    }

    // Step 1: Insert new node between parent and child
    const insertedNode = await CatalogueNode.create({
      ...newNode,
      parent_id: parentId,
      node_level: childNode.node_level, // optional
      status: 'draft',
    });

    // Step 2: Update child to be under new node
    await childNode.update({ parent_id: insertedNode.node_id });

    // Step 3: Update addresses
    const fullInsertedNode = await CatalogueNode.findByPk(insertedNode.node_id);
    await updateAddressRecursively(fullInsertedNode);
    await updateAddressRecursively(childNode); // Child's address changed too

    // Step 4: Invalidate cache
    await cacheDel(`catalogue:children:${parentId}*`);
    await cacheDel(`catalogue:children:${insertedNode.node_id}*`);
    await cacheDel(`catalogue:domains*`);

    // Step 5: Domain propagation if needed
    const domainNode = await findUniformDomainParent(fullInsertedNode);
    if (domainNode?.metadata?.uniform && domainNode?.prices) {
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }

    // Step 6: CPS recomputation if new node is a topic
    if (fullInsertedNode.is_topic && fullInsertedNode.archetype) {
      await recomputeTopicComputedFields(fullInsertedNode);
    }

    return res.json({
      success: true,
      insertedNode: fullInsertedNode,
      updatedChild: {
        id: childNode.node_id,
        newParent: insertedNode.node_id,
      },
    });

  } catch (err) {
    console.error('Error inserting node between:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const deleteAndAdjustNode = async (req, res) => {
  const nodeId = req.params.nodeId;

  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId is required' });
  }

  try {
    const nodeToDelete = await CatalogueNode.findByPk(nodeId);

    if (!nodeToDelete) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const parentId = nodeToDelete.parent_id;

    // Step 1: Reassign all children to the parent of the deleted node
    const children = await CatalogueNode.findAll({ where: { parent_id: nodeId } });

    for (const child of children) {
      await child.update({ parent_id: parentId });
      await updateAddressRecursively(child); // new path
    }

    // Step 2: Delete the node
    await nodeToDelete.destroy();

    // Step 3: Clear caches
    await cacheDel(`catalogue:children:${nodeId}*`);
    if (parentId) {
      await cacheDel(`catalogue:children:${parentId}*`);
    }

    return res.json({
      success: true,
      message: 'Node deleted and tree adjusted successfully',
      affectedChildren: children.map(c => c.node_id),
    });

  } catch (err) {
    console.error('Error deleting node and adjusting tree:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};