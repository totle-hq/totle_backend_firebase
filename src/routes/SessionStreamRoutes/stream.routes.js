import express from "express";
import { getSessionStreamDetails } from "../../controllers/SessionStreamControllers/stream.controller.js";
import authMiddleware from "../../middlewares/authMiddleware.js";
// import { verifyToken } from "../middleware/auth.js"; // make sure this adds req.user

const router = express.Router();

// router.get("/:sessionId", verifyToken, getSessionStreamDetails);
router.get("/:sessionId",authMiddleware, getSessionStreamDetails);

export default router;
