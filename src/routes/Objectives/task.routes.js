import express from 'express';
import {
  createTask,
  getTasksByFeature,
  updateTask,
  deleteTask,
  updateTaskpriority,
} from '../../controllers/Objectives/task.controller.js';

const router = express.Router();

router.post('/features/:featureId', createTask);
router.get('/features/:featureId', getTasksByFeature);
router.put('/features/:featureId/tasks/:taskId', updateTask);
router.delete('/features/:featureId/tasks/:taskId', deleteTask);
router.put("/tasks/priority/:taskId",updateTaskpriority);

export default router;