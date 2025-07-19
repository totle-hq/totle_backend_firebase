import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { ProgressionService } from "../../services/progression.service.js";

/**
 * @desc Get Teaching Progression for Current User (All Topics)
 * @route GET /api/teach/progression
 * @access Private (Requires Auth Middleware)
 */
export const getTeachingProgression = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all topic stats for this teacher
    const stats = await Teachertopicstats.findAll({
      where: { teacherId: userId },
    });

    if (!stats || stats.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No progression data available yet.",
      });
    }

    // Evaluate progression for each topic before sending (ensure up-to-date)
    await Promise.all(
      stats.map(async (s) => await ProgressionService.evaluateProgression(userId, s.node_id))
    );

    // Re-fetch after potential updates
    const updatedStats = await Teachertopicstats.findAll({
      where: { teacherId: userId },
      attributes: ["node_id", "tier", "level", "sessionCount", "rating"],
    });

    return res.status(200).json({
      success: true,
      data: updatedStats,
    });
  } catch (error) {
    console.error("❌ Error in getTeachingProgression:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch teaching progression",
      error: error.message,
    });
  }
};
