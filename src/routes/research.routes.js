import { Router } from "express";
import knowledgeQueueRoutes from "./research/knowledgeQueue.routes.js";

const router = Router();

router.use("/knowledge-queue", knowledgeQueueRoutes);

export default router;
