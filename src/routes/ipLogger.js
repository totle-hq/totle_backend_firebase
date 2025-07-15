import express from 'express';
import fetch from 'node-fetch';
import { userDb } from '../config/db.js';

const router = express.Router();

router.post('/join-session', async (req, res) => {
  const userId = req.body.userId;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userIP = ip.includes('::') ? '8.8.8.8' : ip; // Use dummy IP locally

  try {
    // 🌍 Get location from IP
    const response = await fetch(`http://ip-api.com/json/${userIP}`);
    const data = await response.json();
    const location = `${data.city}, ${data.regionName}, ${data.country}`;

    // 🛡️ Check if IP used by other users
    const checkQuery = `
      SELECT DISTINCT user_id FROM login_logs
      WHERE ip_address = $1 AND user_id != $2
    `;
    const result = await userDb.query(checkQuery, [userIP, userId]);
    const isSuspicious = result.rows.length > 0;

    // 💾 Insert into logs
    const insertQuery = `
      INSERT INTO login_logs (user_id, ip_address, location, is_suspicious)
      VALUES ($1, $2, $3, $4)
    `;
    await userDb.query(insertQuery, [userId, userIP, location, isSuspicious]);

    res.json({
      message: 'Log saved',
      ip: userIP,
      location,
      is_suspicious: isSuspicious
    });
  } catch (error) {
    console.error('Error saving log:', error);
    res.status(500).json({ error: 'Failed to save log' });
  }
});

export default router;
