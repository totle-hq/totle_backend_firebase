// src/routes/tests.progress.routes.js
import express from "express";
import { attachSseClient, verifyTokenFromQuery } from "../utils/progressBus.js";

const router = express.Router();

/**
 * Unified handler for SSE progress
 * Works for:
 *  - GET /api/tests/progress/stream?topicId=...&token=...
 *  - GET /api/tests/progress/subscribe?topicId=...&token=...
 * Also accepts Authorization: Bearer <token> instead of ?token=...
 */
function sseHandler(req, res) {
  try {
    // Token can come from ?token=... or Authorization header
    const headerAuth = req.headers.authorization || "";
    const bearerToken = headerAuth.startsWith("Bearer ")
      ? headerAuth.slice(7).trim()
      : null;

    const token = (req.query.token && String(req.query.token)) || bearerToken;
    const topicId = req.query.topicId ? String(req.query.topicId).trim() : null;

    if (!topicId) {
      return res.status(400).json({ success: false, message: "Missing topicId" });
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing or invalid token" });
    }

    const userId = verifyTokenFromQuery(token);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // This sets proper SSE headers and keeps the socket open
    attachSseClient({ req, res, userId, topicId });
    // Do NOT send/close res here. attachSseClient manages the stream.
  } catch (err) {
    console.error("❌ SSE stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "SSE stream failed" });
    }
  }
}

// Existing path
router.get("/stream", sseHandler);

// **Alias to match your frontend (`/subscribe`)**
router.get("/subscribe", sseHandler);

// (Optional) quick health check for debugging
router.get("/_health", (_req, res) => res.status(200).json({ ok: true }));

export default router;
