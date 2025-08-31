import express from "express";
import { fetchNewsFeed, fetchDeptNewsFeed } from "../services/newsfeed.service.js";

const router = express.Router();

// Founder / Superadmin global feed
router.get("/", async (req, res) => {
  try {
    const data = await fetchNewsFeed();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Department-specific feed
router.get("/:dept", async (req, res) => {
  try {
    const dept = req.params.dept;
    const data = await fetchDeptNewsFeed(dept);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dept news" });
  }
});

export default router;
