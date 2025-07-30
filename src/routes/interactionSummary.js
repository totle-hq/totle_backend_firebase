import express from 'express';
import { userDb } from '../config/db.js';

const router = express.Router();

router.get('/interaction-summary/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      SELECT domain, COUNT(*) AS interactions
      FROM interaction_logs
      WHERE user_id = $1
      GROUP BY domain
      ORDER BY interactions DESC
    `;
    const result = await userDb.query(query, [userId]);

    res.json({
      userId: Number(userId),
      summary: result.rows
    });
  } catch (error) {
    console.error('Error fetching interaction summary:', error);
    res.status(500).json({ error: 'Failed to fetch interaction summary' });
  }
});

export default router;
