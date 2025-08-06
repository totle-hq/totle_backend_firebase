import express from "express";
import { createEpic, deleteEpic, getEpicsByKeyResult, updateEpic, updateEpicpriority } from "../../controllers/Objectives/epic.controller.js";
const router=express.Router();
router.post("/key-results/:keyResultId",createEpic);
router.get("/key-results/:keyResultId",getEpicsByKeyResult);
router.delete("/key-results/:keyResultId/epics/:epicId",deleteEpic);
router.put("/key-results/:keyResultId/epics/:epicId",updateEpic);

router.put("/epics/:epicId",updateEpicpriority);

export default router;