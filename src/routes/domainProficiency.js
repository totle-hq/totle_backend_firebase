import express from 'express';
import { userDb } from '../config/db.js';

const router = express.Router();

router.get('/domain-proficiency/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const query = `
  SELECT domain_name, SUM(time_spent) AS total_time
  FROM domain_activity
  WHERE user_id = $1
  GROUP BY domain_name
  ORDER BY total_time DESC
`;

    const result = await userDb.query(query, [userId]);

    res.json({
      userId,
      top_domains: result.rows,
      message: 'Top domains inferred from user activity.'
    });
  } catch (error) {
    console.error('Error fetching domain proficiency:', error);
    res.status(500).json({ error: 'Failed to fetch domain proficiency' });
  }
});

export default router;
