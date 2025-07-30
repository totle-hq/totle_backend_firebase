import express from 'express';
import { userDb } from '../config/db.js';

const router = express.Router();

// Log interaction with a domain/topic
router.post('/log-interaction', async (req, res) => {
  const { userId, domain, actionType } = req.body;

  if (!userId || !domain || !actionType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const query = `
      INSERT INTO interaction_logs (user_id, domain, action_type)
      VALUES ($1, $2, $3)
    `;
    await userDb.query(query, [userId, domain, actionType]);

    res.json({ message: 'Interaction logged successfully' });
  } catch (error) {
    console.error('Error logging interaction:', error);
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

export default router;
