import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error("❌ Missing DB environment variables!");
  process.exit(1);
}

// ✅ Use explicit database parameters
const sequelize1 = new Sequelize({
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432, // Default to 5432 if not set
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_SSL === "true" ? { require: true, rejectUnauthorized: false } : false,
  },
});

console.log(`✅ Connecting to PostgreSQL at ${process.env.DB_HOST}:${process.env.DB_PORT}...`);

export { sequelize1 };

