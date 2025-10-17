// src/routes/cps/iqQuestion.routes.js
// ----------------------------------------------------------------------------
// Router for IQ Question CRUD
// ----------------------------------------------------------------------------

import { Router } from "express";
import {
  createIQQuestion,
  listIQQuestions,
  getIQQuestion,
  updateIQQuestion,
  deleteIQQuestion,
} from "../../controllers/cps/iqQuestion.controller.js";

const router = Router();

// Create
router.post("/cps/iq-questions", createIQQuestion);

// List (filters: ?dimension=&active=true|false&search=&page=&pageSize=&includeChildren=true|false)
router.get("/cps/iq-questions", listIQQuestions);

// Read
router.get("/cps/iq-questions/:id", getIQQuestion);

// Update (full replace for choices if provided)
router.put("/cps/iq-questions/:id", updateIQQuestion);

// Delete (cascade)
router.delete("/cps/iq-questions/:id", deleteIQQuestion);

export default router;
