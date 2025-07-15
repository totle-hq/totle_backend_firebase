// controllers/session/bookSession.controller.js
import { BookedSession } from "../../models/BookedSession.js";

export const bookFreeSession = async (req, res) => {
  try {
    const learnerId = req.user.id; // from token
    const { topic_id } = req.body;

    if (!topic_id) {
      return res.status(400).json({ error: true, message: "Topic ID is required" });
    }

    const newSession = await BookedSession.create({
      learner_id: learnerId,
      topic_id,
    });

    return res.status(201).json({
      success: true,
      message: "Session booked successfully",
      session: newSession,
    });
  } catch (error) {
    console.error("❌ Error booking session:", error);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
/*// controllers/session/bookSession.controller.js
import { BookedSession } from "../../models/BookedSession.js";

export const bookFreeSession = async (req, res) => {
  try {
    const learnerId = req.user.id; // from token
    const { topic_id } = req.body;

    if (!topic_id) {
      return res.status(400).json({ error: true, message: "Topic ID is required" });
    }

    const newSession = await BookedSession.create({
      learner_id: learnerId,
      topic_id,
    });

    return res.status(201).json({
      success: true,
      message: "Session booked successfully",
      session: newSession,
    });
  } catch (error) {
    console.error("❌ Error booking session:", error);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
*/