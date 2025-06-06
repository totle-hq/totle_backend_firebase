import express from 'express';
import { trackCtaClick, getAllCtaData } from '../controllers/cta.controller.js';

const router = express.Router();

router.post('/cta-track', trackCtaClick);
router.get('/cta-track', getAllCtaData);

export default router;
