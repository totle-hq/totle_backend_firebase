import express from "express";
import DeptChatMessage from "../Models/DeptChatMessage.js";

const router = express.Router();

// Get last 50 messages for a department
router.get("/:department", async (req, res) => {
  try {
    const { department } = req.params;

    const msgs = await DeptChatMessage.findAll({
      where: { department },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    // Reverse so oldest → newest
    res.json(msgs.reverse());
  } catch (err) {
    console.error("❌ Chat history fetch error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

export default router;
