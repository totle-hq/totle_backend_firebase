// src/controllers/catalogueNode.controller.js

import { Op } from "sequelize";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { redisClient } from "../../config/redis.js";
const inMemoryCache = new Map(); // fallback

const CACHE_TTL = 300; // 5 minutes

// 🔧 Util: Cache Wrapper
async function cacheGet(key) {
  try {
    const value = await redisClient.get(key);
    if (value) return JSON.parse(value);
  } catch (err) {
    return inMemoryCache.get(key);
  }
}

async function cacheSet(key, data) {
  try {
    await redisClient.set(key, JSON.stringify(data), "EX", CACHE_TTL);
  } catch (err) {
    inMemoryCache.set(key, data);
    setTimeout(() => inMemoryCache.delete(key), CACHE_TTL * 1000);
  }
}

async function cacheDel(pattern) {
  try {
    const keys = await redisClient.keys(pattern);
    for (let key of keys) await redisClient.del(key);
  } catch (err) {
    inMemoryCache.clear(); // simple fallback
  }
}

const findUniformDomainParent = async (node) => {
  if (!node?.parent_id) return null;

  const parent = await CatalogueNode.findByPk(node.parent_id);
  if (!parent) return null;

  if (parent.is_domain && parent.metadata?.uniform) {
    return parent;
  }

  // Continue digging upward
  return await findUniformDomainParent(parent);
};

async function distributePricesRecursively(parentId, prices) {
  const children = await CatalogueNode.findAll({ where: { parent_id: parentId } });
  if (children.length === 0) return;

  const priceKeys = ['bridgers', 'experts', 'masters', 'legends'];
  const priceMatrix = {};

  for (const key of priceKeys) {
    const total = prices[key] || 0;
    const avg = Math.floor(total / children.length);
    const remainder = total - avg * children.length;

    // Distribute base avg to all
    priceMatrix[key] = Array(children.length).fill(avg);

    // Add 1 to first `remainder` children
    for (let i = 0; i < remainder; i++) {
      priceMatrix[key][i] += 1;
    }
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childPrices = {};
    for (const key of priceKeys) {
      childPrices[key] = priceMatrix[key][i];
    }

    await child.update({ prices: childPrices });

    // Recurse with current child prices
    await distributePricesRecursively(child.node_id, childPrices);
  }
}


// 🟢 Create node
export const createNode = async (req, res) => {
  try {
    const node = await CatalogueNode.create(req.body);
    await cacheDel(`catalogue:children:${node.parent_id}*`);

    const domainNode = await findUniformDomainParent(node);

    if (domainNode && domainNode.prices) {
      console.log(`📤 [createNode] Triggering uniform distribution from domain "${domainNode.name}"`);
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }

    return res.status(201).json(node);
  } catch (err) {
    console.error("Error creating node:", err, err.message);
    return res.status(400).json({ error: err.message });
  }
};

// 🟢 Get node by ID
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

// 🟢 Get children of a node
export const getChildren = async (req, res) => {
  const parentId = req.query.parent_id || null;
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

// 🟡 Update node
export const updateNode = async (req, res) => {
  try {
    const node = await CatalogueNode.findByPk(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });

    await node.update(req.body);
    await cacheDel(`catalogue:node:${req.params.id}`);
    await cacheDel(`catalogue:children:${node.parent_id}*`);
    const domainNode = await findUniformDomainParent(node);

    if (domainNode && domainNode.prices) {
      console.log(`📤 [createNode] Triggering uniform distribution from domain "${domainNode.name}"`);
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }

    return res.json(node);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// 🔴 Safe delete node
export const deleteNode = async (req, res) => {
  try {
    const node = await CatalogueNode.findByPk(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });

    const children = await CatalogueNode.findOne({ where: { parent_id: node.node_id } });
    if (children) return res.status(400).json({ error: "Node has children, cannot delete" });

    const parent = node.parent_id
      ? await CatalogueNode.findByPk(node.parent_id)
      : null;

    await node.destroy();
    await cacheDel(`catalogue:node:${req.params.id}`);
    await cacheDel(`catalogue:children:${node.parent_id}*`);

    const domainNode = await findUniformDomainParent(parent); // this will walk up from parent

    if (domainNode && domainNode.prices) {
      console.log(`♻️ [deleteNode] Redistributing prices from domain "${domainNode.name}" after deletion`);
      await distributePricesRecursively(domainNode.node_id, domainNode.prices);
    }
    
    return res.json({ message: "Node deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 🧭 Breadcrumbs (optional)
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
// ➕ Add subtopics to a topic node
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

    const enrichedSubtopics = subtopics.map((s) => ({
      name: s.name,
      parent_id: topic.node_id,
      node_level: `${topic.node_level}_subtopic`,
      metadata: { is_subtopic: true }
    }));

    const created = await CatalogueNode.bulkCreate(enrichedSubtopics);
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
        metadata: { is_subtopic: true }
      },
      order: [["created_at", "ASC"]]
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
