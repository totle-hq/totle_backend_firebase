import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { ProgressionService } from "../../services/progression.service.js";
import { Session } from "../../Models/SessionModel.js";

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
        global: {
          rating: 0,
          sessions_done: 0
        },
        message: "No progression data available yet.",
      });
    }

    // Evaluate progression for each topic before sending (ensure up-to-date)
    await Promise.all(
      stats.map(async (s) =>
        await ProgressionService.evaluateProgression(userId, s.node_id)
      )
    );

    // Re-fetch after progression updates (topic-wise)
    const updatedStats = await Teachertopicstats.findAll({
      where: { teacherId: userId },
      attributes: ["node_id", "tier", "level", "sessionCount", "rating"],
    });

    /* -----------------------------------------------------------
       GLOBAL AGGREGATED PROGRESSION (YOUR NEW REQUIREMENT)
       ----------------------------------------------------------- */

    // 1. Total completed sessions
    const completedSessions = await Session.count({
      where: {
        teacher_id: userId,
        status: "completed",
      },
    });

    // 2. Weighted rating across all topics
    let weightedSum = 0;
    let total = 0;

    updatedStats.forEach((s) => {
      const count = s.sessionCount || 0;
      const rating = s.rating || 0;

      weightedSum += count * rating;
      total += count;
    });

    const globalRating =
      total > 0 ? parseFloat((weightedSum / total).toFixed(2)) : 0;

    /* -----------------------------------------------------------
       RESPONSE (Everything preserved, only "global" added)
       ----------------------------------------------------------- */

    return res.status(200).json({
      success: true,
      data: updatedStats,   // per-topic progression (unchanged)
      global: {
        rating: globalRating,
        sessions_done: completedSessions,
      },
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
