import express from "express";
import { fetchNewsFeed } from "../services/newsfeed.service.js";

const router = express.Router();

/**
 * GET /api/newsfeed
 * Returns curated, role/department-tagged news
 */
router.get("/", async (req, res) => {
  try {
    const news = await fetchNewsFeed();
    res.json(news);
  } catch (err) {
    console.error("❌ NewsFeed error:", err);
    res.status(500).json({ message: "Failed to fetch newsfeed", error: err.message });
  }
});

export default router;
