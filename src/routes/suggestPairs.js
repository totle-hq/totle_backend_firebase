import express from 'express';
import { userDb } from '../config/db.js';

const router = express.Router();

router.get('/suggest-pairs', async (req, res) => {
  try {
    // 1. Fetch all domain proficiency data
    const result = await userDb.query(`
      SELECT user_id, domain_name, proficiency_score
      FROM domain_proficiency
    `);

    const data = result.rows;

    // 2. Group data by domain
    const domainGroups = {};
    data.forEach(({ user_id, domain_name, proficiency_score }) => {
      if (!domainGroups[domain_name]) domainGroups[domain_name] = [];
      domainGroups[domain_name].push({ user_id, proficiency_score });
    });

    const suggestions = [];

    // 3. For each domain, match high scorers with low scorers
    for (const domain in domainGroups) {
      const users = domainGroups[domain];
      const mentors = users.filter(u => u.proficiency_score >= 70);
      const learners = users.filter(u => u.proficiency_score <= 30);

      const minPairs = Math.min(mentors.length, learners.length);

      for (let i = 0; i < minPairs; i++) {
        suggestions.push({
          domain,
          mentor: mentors[i],
          learner: learners[i],
        });
      }
    }

    res.json({ suggestions, message: "Suggested mentor-learner pairs generated." });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;
