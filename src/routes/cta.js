// import express from 'express';
// import pkg from 'pg';
// const { pool } = pkg;

// const router = express.Router();

// router.post('/cta-tracking', async (req, res) => {
//   const { page, cta_name } = req.body;

//   if (!page || !cta_name) {
//     return res.status(400).json({ error: 'Missing page or cta_name' });
//   }

//   try {
//     await pool.query(
//       'INSERT INTO cta_tracking (page, cta_name) VALUES ($1, $2)',
//       [page, cta_name]
//     );
//     res.status(201).json({ message: 'CTA tracked successfully' });
//   } catch (err) {
//     console.error('Error tracking CTA:', err);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// export const ctaRoutes = router;

import express from 'express';
import { userDb } from '../config/db.js'; // adjust path as needed

const router = express.Router();

router.post('/cta-tracking', async (req, res) => {
 const { page, cta_name } = req.body;
  console.log('Received CTA track request:', req.body);

  if (!page || !cta_name) {
    return res.status(400).json({ error: 'page and cta_name are required' });
  }

  try {
    await userDb.query(
      'INSERT INTO cta_tracking (page, cta_name) VALUES ($1, $2)',
      [page, cta_name]
    );
    res.status(200).json({ message: 'CTA tracked successfully' });
  } catch (error) {
    console.error('Error tracking CTA:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
