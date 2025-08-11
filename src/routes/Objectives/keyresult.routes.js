// routes/Objectives/keyresult.routes.js

import express from 'express';
import {
  createKeyResult,
  deleteKeyResult,
  getKeyResultsByObjective,
  updateKeyResult,
  updatekeyresultPriority,
  getKeyResultById
} from '../../controllers/Objectives/keyresult.controller.js';

const router = express.Router();

// @route   POST /api/objectives/:objectiveId/key-results
// @desc    Create a key result for an objective
router.post('/:objectiveId/key-results', createKeyResult);
router.get('/key-results/:id/detail',getKeyResultById)

// @route   GET /api/objectives/:objectiveId/key-results
// @desc    Fetch all key results under an objective
router.get('/:objectiveId/key-results', getKeyResultsByObjective);

router.delete("/:objectiveId/key-results/:keyResultId", deleteKeyResult); 
router.put("/:objectiveId/key-results/:keyResultId", updateKeyResult);
router.put("/keyresult/priority/:keyresultId",updatekeyresultPriority);

export default router;
