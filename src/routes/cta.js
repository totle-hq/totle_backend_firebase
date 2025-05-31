import express from 'express';
import { trackCTA } from '../controllers/cta.contoroller.js';

const router = express.Router();

router.post('/cta-tracking', trackCTA);

export default router;
