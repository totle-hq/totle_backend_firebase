// src/config/database.js

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// 🚨 Validate required environment variables
if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error("❌ Missing required DB environment variables.");
  process.exit(1);
}

// 🛠️ Define the Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === "true" ? { require: true, rejectUnauthorized: false } : false,
    },
  }
);

// 🧪 Test connection
sequelize.authenticate()
  .then(() => console.log("✅ Sequelize DB connection established successfully."))
  .catch(err => {
    console.error("❌ Failed to connect Sequelize DB:", err);
    process.exit(1);
  });

export default sequelize;
