import express from "express";
import {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
  restoreTopic,
  getTopicsBySubject,
} from "../../controllers/CatalogControllers/topic.controller.js";

const router = express.Router();

// 🟢 Fetch all topics
router.get("/", getAllTopics);

// 🟢 Fetch a topic by ID
router.get("/:id", getTopicById);

// 🟢 Fetch topics by subject ID
router.get("/subject/:subjectId", getTopicsBySubject);

// 🟢 Create a new topic
router.post("/", createTopic);

// 🟡 Update a topic
router.put("/:id", updateTopic);

// 🔴 Soft delete a topic
router.delete("/:id", deleteTopic);

// ♻ Restore a soft-deleted topic
router.patch("/restore/:id", restoreTopic);

export default router;
