// routes/Objectives/feature.routes.js
import express from 'express';
import {
  createFeature,
  getFeaturesByEpic,
  updateFeature,
  deleteFeature,
  updatefeaturePriority,
} from '../../controllers/Objectives/feature.controller.js';

const router = express.Router();

router.post('/epics/:epicId', createFeature);
router.get('/epics/:epicId', getFeaturesByEpic);
router.put('/epics/:epicId/features/:featureId', updateFeature);
router.delete('/epics/:epicId/features/:featureId', deleteFeature);
router.put("/feature/priority/:featureId",updatefeaturePriority);
export default router;