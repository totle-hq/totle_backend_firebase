import express from 'express';
import {
  createObjective,
  getAllObjectives,
  getObjectiveById,
  updateObjective,
  archiveObjective,
  deleteObjective, // ✅ Add this
} from '../../controllers/Objectives/objective.controller.js';


const router = express.Router();

// ✅ Create new objective
router.post('/', createObjective);

// ✅ Get all objectives (optionally filter by level)
router.get('/', getAllObjectives);

// ✅ Get specific objective by ID or code
router.get('/:id', getObjectiveById);

// ✅ Update objective (title, level)
router.put('/:id', updateObjective);

// ✅ Archive objective (soft delete)
router.patch('/:id/archive', archiveObjective);

// ❌ PERMANENT DELETE
router.delete('/:id', deleteObjective);


export default router;
