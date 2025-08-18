import { Op } from "sequelize";
import logger from "../utils/logger.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { PresentNodeStats } from "../Models/analytics/PresentNodeStatsmodel.js";
import { AbsentNodeStats } from "../Models/analytics/AbsentNodeStatsmodel.js";

export const searchCatalogue = async (req, res) => {
  try {
    const { term } = req.query;
console.log(term);
    if (!term || term.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    const searchTerm = term.trim();
    const now = new Date();

    // Search for nodes matching the term
    const nodes = await CatalogueNode.findAll({
      where: {
        name: { [Op.iLike]: `%${searchTerm}%` },
      },
    });

    if (nodes.length > 0) {
      // Found matches → update PresentNodeStats
      for (const node of nodes) {
        const [stat] = await PresentNodeStats.findOrCreate({
          where: { node_id: node.node_id },
          defaults: {
            nodeId: node.node_id,
            searchCount: 0,
            lastSearched: now,
          },
        });

        await stat.update({
          searchCount: stat.searchCount + 1,
          lastSearched: now,
        });
      }

      return res.status(200).json({
        success: true,
        found: true,
        count: nodes.length,
        data: nodes,
      });
    }

    // No matches → update AbsentNodeStats
    const [missingStat, missingCreated] = await AbsentNodeStats.findOrCreate({
      where: { searchTerm },
      defaults: {
        searchTerm,
        searchCount: 0,
        firstSeen: now,
        lastSearched: now,
      },
    });

    await missingStat.update({
      searchCount: missingStat.searchCount + 1,
      lastSearched: now,
    });

    return res.status(200).json({
      success: true,
      found: false,
      message: "Topic not found in catalogue",
      statsUpdated: !missingCreated,
    });

  } catch (error) {
    console.log(error)
    logger.error("Error searching catalogue:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
