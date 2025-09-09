// src/routes/progress.routes.js
import express from "express";
import { attachSseClient, verifyTokenFromQuery } from "../utils/progressBus.js";

const router = express.Router();

/**
 * GET /api/progress/subscribe?topicId=UUID
 *
 * Auth:
 * - Preferred: your normal auth middleware sets req.user.id
 * - Fallback: pass ?token=JWT in the query (we'll verify it)
 *
 * Server-Sent Events stream carrying generation phases:
 *   { phase, status, note, ... }
 */
router.get("/subscribe", async (req, res) => {
  try {
    // 1) Resolve userId (auth middleware OR ?token=...)
    let userId = req?.user?.id;
    if (!userId) {
      const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;
      const token = bearer || req.query.token;
      userId = verifyTokenFromQuery(token);
    }

    // 2) Require topicId
    const topicId = req.query.topicId;
    if (!userId || !topicId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or topicId",
      });
    }

    // 3) Attach this connection to SSE channel (userId:topicId)
    attachSseClient({ req, res, userId, topicId });
  } catch (err) {
    console.error("❌ /progress/subscribe failed:", err);
    // Only JSON if headers not already sent
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "SSE setup failed" });
    }
    try { res.end(); } catch {}
  }
});

export default router;
