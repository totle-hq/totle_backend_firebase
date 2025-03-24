// src/config/sequelizeCatalog.js

import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// ✅ Create a Sequelize instance for the catalogue DB
const sequelizeCatalog = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
  logging: false, // Set to console.log if you want query logs
  define: {
    underscored: true,
    freezeTableName: true,
    timestamps: true,
  },
});

try {
  await sequelizeCatalog.authenticate();
  console.log("✅ Sequelize (Catalogue DB) connected successfully.");
} catch (error) {
  console.error("❌ Sequelize connection error (Catalogue DB):", error);
}

export default sequelizeCatalog;
