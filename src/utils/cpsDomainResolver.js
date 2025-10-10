/**
 * Utility: cpsDomainResolver
 * ---------------------------------------------
 * Finds the root domain node_id for any topic node.
 * Used by CPS EMA service to assign correct context_ref_id.
 *
 * Logic:
 *  - Input: topicId (UUID)
 *  - Walks upward via parent_id chain until a node_type === "domain" is found
 *  - Returns that domain's node_id (UUID)
 *  - Returns null if no valid domain ancestor exists
 */

import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";

/**
 * Get the root domain for a given topic node.
 * @param {string} topicId - UUID of the topic or subnode
 * @param {object} [transaction] - Optional Sequelize transaction for consistency
 * @returns {Promise<string|null>} - The UUID of the domain node, or null if not found
 */
export async function getDomainIdForTopic(topicId, transaction = null) {
  try {
    if (!topicId) return null;

    let node = await CatalogueNode.findByPk(topicId, { transaction });
    if (!node) {
      console.warn(`[CPS][Resolver] No CatalogueNode found for topicId ${topicId}`);
      return null;
    }

    // Traverse upwards until we reach a domain node
    const visited = new Set();
    while (node && node.parent_id && !visited.has(node.node_id)) {
      visited.add(node.node_id);

      if (node.node_type === "domain") {
        return node.node_id;
      }

      const parent = await CatalogueNode.findByPk(node.parent_id, { transaction });
      if (!parent) break;
      node = parent;
    }

    // If loop ends without finding a domain, fallback
    if (node?.node_type === "domain") {
      return node.node_id;
    }

    console.warn(`[CPS][Resolver] Domain not found for topicId ${topicId}`);
    return null;
  } catch (err) {
    console.error("[CPS][Resolver] Error resolving domain for topic:", topicId, err);
    return null;
  }
}
