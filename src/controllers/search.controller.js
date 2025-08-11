import { Op } from "sequelize";
import logger from "../utils/logger.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { PresentNodeStats } from "../Models/analytics/PresentNodeStatsmodel.js";
import { AbsentNodeStats } from "../Models/analytics/AbsentNodeStatsmodel.js";

export const searchCatalogue = async (req, res) => {
  try {
    const { term } = req.query;

    if (!term || term.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search term is required"
      });
    }

    const searchTerm = term.trim();
    const now = new Date();

    const nodes = await CatalogueNode.findAll({
      where: {
        name: { [Op.iLike]: `%${searchTerm}%` } 
      }
    });

    if (nodes.length > 0) {
      for (const node of nodes) {

        const [stat, created] = await PresentNodeStats.findOrCreate({
          where: { nodeId: node.nodeId },
          defaults: {
            nodeId: node.nodeId,
            name: node.name,
            searchVolume: 0,
            firstSeen: now,
            lastSeen: now
          }
        });

        
        await stat.update({
          searchVolume: stat.searchVolume + 1,
          lastSeen: now
        });
      }

      return res.status(200).json({
        success: true,
        found: true,
        count: nodes.length,
        data: nodes
      });
    }

    
    const [missingStat, missingCreated] = await AbsentNodeStats.findOrCreate({
      where: { name: searchTerm },
      defaults: {
        name: searchTerm,
        searchVolume: 0,
        firstSeen: now,
        lastSeen: now
      }
    });

    await missingStat.update({
      searchVolume: missingStat.searchVolume + 1,
      lastSeen: now
    });

    return res.status(200).json({
      success: true,
      found: false,
      message: "Topic not found in catalogue",
      statsUpdated: !missingCreated
    });

  } catch (error) {
    console.log(error)
    logger.error(" Error searching catalogue:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
