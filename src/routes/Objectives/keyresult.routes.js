// routes/Objectives/keyresult.routes.js

import express from 'express';
import {
  createKeyResult,
  getKeyResultsByObjective,
} from '../../controllers/Objectives/keyresult.controller.js';

const router = express.Router();

// @route   POST /api/objectives/:objectiveId/key-results
// @desc    Create a key result for an objective
router.post('/:objectiveId/key-results', createKeyResult);

// @route   GET /api/objectives/:objectiveId/key-results
// @desc    Fetch all key results under an objective
router.get('/:objectiveId/key-results', getKeyResultsByObjective);

export default router;
