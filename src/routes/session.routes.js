import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js"; // ✅ Ensure ".js" is included
import { activeSession, completedSession, createSession, sessionDetails } from "../controllers/session.controller.js";

const router = express.Router();

router.post("/create", authMiddleware, createSession);
router.get("/:sessionId", authMiddleware, sessionDetails);
router.put("/:sessionId/start", authMiddleware, activeSession);
router.put("/:sessionId/complete", authMiddleware, completedSession);

export default router;