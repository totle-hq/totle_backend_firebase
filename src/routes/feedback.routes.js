import express, { Router } from "express";
import { getAllFeedback , postFeedBack } from "../controllers/feedback.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/",postFeedBack);
router.get("/",authMiddleware,getAllFeedback);

export default router;