import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const router = express.Router();

/**
 * POST /nucleus/login
 * Authenticates Nucleus users (e.g., Founder, Superadmin) from nucleus_users table.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch nucleus user
    const result = await pool.query('SELECT * FROM nucleus_users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Log to nucleus audit
    await pool.query(
      `INSERT INTO nucleus_audit_logs (user_id, action, metadata, timestamp)
       VALUES ($1, 'login', $2, NOW())`,
      [user.id, JSON.stringify({ role: user.role, email: user.email })]
    );

    return res.json({
      token,
      admin: {
        id: user.id,
        name: user.name || 'Founder',
        email: user.email,
        global_role: user.role,
        department: 'Nucleus',
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
