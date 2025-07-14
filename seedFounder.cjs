require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

(async () => {
  const email = 'sriragh@totle.co';
  const password = process.env.FOUNDER_PASSWORD;

  if (!password) {
    console.error('❌ FOUNDER_PASSWORD is not set in .env');
    process.exit(1);
  }

  try {
    const result = await pool.query('SELECT * FROM nucleus_users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      console.log('👑 Founder already exists.');
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 12);

    await pool.query(`
      INSERT INTO nucleus_users (email, password_hash, role, created_at)
      VALUES ($1, $2, 'Founder', NOW())
    `, [email, hashed]);

    await pool.query(`
      INSERT INTO nucleus_audit_logs (user_id, action, metadata, timestamp)
      SELECT id, 'seed-founder', $2, NOW()
      FROM nucleus_users WHERE email = $1
    `, [email, JSON.stringify({ seededBy: 'script', isFounder: true })]);

    console.log('✅ Nucleus Founder account seeded.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  }
})();
