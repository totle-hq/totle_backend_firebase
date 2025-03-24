// src/controllers/catalogue.controller.js

import { CatalogueNode } from "../Models/catalogueNode.model.js";
import { Op } from "sequelize";

/**
 * Fetch all nodes or by parent_id
 */
export const getNodes = async (req, res) => {
  try {
    const { parent_id } = req.query;

    const whereClause = parent_id ? { parent_id } : {};

    const nodes = await CatalogueNode.findAll({ where: whereClause });

    return res.status(200).json(nodes);
  } catch (error) {
    console.error("❌ Error fetching nodes:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get a single node by ID
 */
export const getNodeById = async (req, res) => {
  try {
    const { node_id } = req.params;

    const node = await CatalogueNode.findByPk(node_id);

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    return res.status(200).json(node);
  } catch (error) {
    console.error("❌ Error fetching node:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Create a new catalogue node
 */
export const createNode = async (req, res) => {
  try {
    const data = req.body;

    const node = await CatalogueNode.create(data);

    return res.status(201).json(node);
  } catch (error) {
    console.error("❌ Error creating node:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update a catalogue node
 */
export const updateNode = async (req, res) => {
  try {
    const { node_id } = req.params;
    const updates = req.body;

    const node = await CatalogueNode.findByPk(node_id);

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    await node.update({ ...updates });

    return res.status(200).json(node);
  } catch (error) {
    console.error("❌ Error updating node:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Delete a node and all its children recursively
 */
export const deleteNode = async (req, res) => {
  try {
    const { node_id } = req.params;

    const toDelete = await CatalogueNode.findAll({
      where: {
        [Op.or]: [
          { node_id },
          { parent_id: node_id } // Simple 1-level cascade, can be extended
        ],
      },
    });

    if (!toDelete || toDelete.length === 0) {
      return res.status(404).json({ message: "Node or descendants not found" });
    }

    const deletedIds = toDelete.map((n) => n.node_id);

    await CatalogueNode.destroy({
      where: { node_id: deletedIds },
    });

    return res.status(200).json({
      message: "Node and its children deleted successfully.",
      deleted: deletedIds,
    });
  } catch (error) {
    console.error("❌ Error deleting node:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Distribute domain prices equally to all descendant topics
 */
export const updateDomainPrices = async (req, res) => {
    try {
      const { domain_id } = req.params;
  
      const domain = await CatalogueNode.findByPk(domain_id);
      if (!domain || !domain.is_domain) {
        return res.status(404).json({ message: "Domain not found or invalid" });
      }
  
      const allNodes = await CatalogueNode.findAll();
      const topics = allNodes.filter(
        (n) => n.is_topic && isDescendant(n, domain_id, allNodes)
      );
  
      if (topics.length === 0) {
        return res.status(400).json({ message: "No topics found under domain" });
      }
  
      const perTopicPrice = {
        beginner: Math.round(domain.prices.beginner / topics.length),
        intermediate: Math.round(domain.prices.intermediate / topics.length),
        advanced: Math.round(domain.prices.advanced / topics.length),
        expert: Math.round(domain.prices.expert / topics.length),
      };
  
      for (const topic of topics) {
        await topic.update({ prices: perTopicPrice });
      }
  
      return res.status(200).json({
        message: "Prices updated for topics under domain.",
        updated_topics: topics.map((t) => t.node_id),
      });
    } catch (error) {
      console.error("❌ Error updating domain prices:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  
  /**
   * Recalculate subject prices based on its topics,
   * then update the domain total price.
   */
  export const updateSubjectPrices = async (req, res) => {
    try {
      const { subject_id } = req.params;
  
      const subject = await CatalogueNode.findByPk(subject_id);
      if (!subject || subject.is_domain || subject.is_topic) {
        return res.status(404).json({ message: "Subject not found or invalid" });
      }
  
      const topics = await CatalogueNode.findAll({
        where: { parent_id: subject_id, is_topic: true },
      });
  
      if (topics.length === 0) {
        return res.status(400).json({ message: "No topics under this subject" });
      }
  
      const totalPrices = topics.reduce(
        (acc, node) => {
          acc.beginner += node.prices.beginner;
          acc.intermediate += node.prices.intermediate;
          acc.advanced += node.prices.advanced;
          acc.expert += node.prices.expert;
          return acc;
        },
        { beginner: 0, intermediate: 0, advanced: 0, expert: 0 }
      );
  
      await subject.update({ prices: totalPrices });
  
      if (subject.parent_id) {
        const domain = await CatalogueNode.findByPk(subject.parent_id);
        if (domain && domain.is_domain) {
          const siblings = await CatalogueNode.findAll({
            where: {
              parent_id: domain.node_id,
              is_topic: false,
              is_domain: false,
            },
          });
  
          const aggregate = siblings.reduce(
            (acc, node) => {
              acc.beginner += node.prices.beginner;
              acc.intermediate += node.prices.intermediate;
              acc.advanced += node.prices.advanced;
              acc.expert += node.prices.expert;
              return acc;
            },
            { beginner: 0, intermediate: 0, advanced: 0, expert: 0 }
          );
  
          await domain.update({ prices: aggregate });
        }
      }
  
      return res.status(200).json({
        message: "Subject prices recalculated and domain updated.",
        subject_id,
      });
    } catch (error) {
      console.error("❌ Error updating subject prices:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  
  /**
   * Utility: Check if a node is descendant of given parent
   */
  function isDescendant(node, parentId, allNodes) {
    if (!node.parent_id) return false;
    if (node.parent_id === parentId) return true;
  
    const parent = allNodes.find((n) => n.node_id === node.parent_id);
    return parent ? isDescendant(parent, parentId, allNodes) : false;
  }
  