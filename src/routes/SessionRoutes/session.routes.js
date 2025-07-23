import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";
import { bookFreeSession } from "../../controllers/SessionStreamControllers/bookSession.controller.js";
const router = express.Router();

// 📝 Route to directly book a session
router.post("/book", authMiddleware, bookFreeSession);

export default router;