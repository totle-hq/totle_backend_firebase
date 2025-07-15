import express from 'express';
import { userDb } from '../config/db.js';

const router = express.Router();

router.post('/log-domain-activity', async (req, res) => {
  const { userId, domainName, timeSpent } = req.body;

  try {
    const query = `
      INSERT INTO domain_activity (user_id, domain_name, time_spent)
      VALUES ($1, $2, $3)
    `;
    await userDb.query(query, [userId, domainName, timeSpent]);

    res.json({ message: 'Domain activity logged successfully' });
  } catch (error) {
    console.error('Error logging domain activity:', error);
    res.status(500).json({ error: 'Failed to log domain activity' });
  }
});

export default router;
