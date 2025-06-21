import express from "express";
import { getSessionStreamDetails } from "../../controllers/SessionStreamControllers/stream.controller.js";
// import { verifyToken } from "../middleware/auth.js"; // make sure this adds req.user

const router = express.Router();

// router.get("/:sessionId", verifyToken, getSessionStreamDetails);
router.get("/:sessionId", getSessionStreamDetails);

export default router;
