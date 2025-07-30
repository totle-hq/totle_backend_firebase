import express, { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { getInsights } from "../controllers/Insights.controller.js";
const router = express.Router();

router.get("/insights",authMiddleware,getInsights);

export default router;