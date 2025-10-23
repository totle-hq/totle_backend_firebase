// src/config/sequelize.js (or your actual path)
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.log(process.env.DB_HOST, process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD);
  console.error("❌ Missing DB environment variables!");
  process.exit(1);
}

const USE_SSL =
  process.env.DB_SSL === "true"
    ? { require: true, rejectUnauthorized: false }
    : false;

// ✅ Force UTC at the driver level; keep storage/logic in UTC.
//    NOTE: Postgres columns should be TIMESTAMPTZ for perfect behavior.
export const sequelize1 = new Sequelize({
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,

  // 👇 Important: Sequelize timezone is used when sending stringified dates.
  // We keep everything in UTC; the app converts to user-local at the edges.
  timezone: '+00:00',

  dialectOptions: {
    ssl: USE_SSL,
    // 👇 Ensure node-postgres works in UTC for read/write
    useUTC: true,
    // Return native JS Dates (UTC) instead of stringifying
    dateStrings: false,
  },

  // (Optional) reasonable pool; tweak if needed
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

console.log(
  `✅ Connecting to PostgreSQL (UTC mode) at ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}...`
);
