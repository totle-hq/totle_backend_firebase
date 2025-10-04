import { Router } from "express";
import {
  getKnowledgeQueue,
  createKnowledgeQueue,
  updateKnowledgeQueue,
  deleteKnowledgeQueue,
  reorderKnowledgeQueue,
} from "../../controllers/ResearchControllers/knowledgeQueue.controller.js";

const router = Router();

router.get("/", getKnowledgeQueue);
router.post("/", createKnowledgeQueue);

// 👇 specific path must come before the param
router.put("/reorder", reorderKnowledgeQueue);

router.put("/:id", updateKnowledgeQueue);
router.delete("/:id", deleteKnowledgeQueue);


export default router;
