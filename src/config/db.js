// import pkg from "pg";  // Correct way to import CommonJS modules in ES Modules
// import dotenv from "dotenv";

// dotenv.config();

// const { Pool } = pkg; // Extract Pool from default import

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// const pool2 = new Pool({
//   connectionString: process.env.DATABASE_URL2,
// })

// pool
//   .connect()
//   .then(() => {
//     console.log("✅ PostgreSQL Connected!")
//   })
//   .catch((err) => console.error("❌ Connection Error:", err));

// pool2.connect()
//   .then(() => {
//     console.log("Catalog db connected!")
//   })
//   .catch(err=> console.log("Catalog db connection error:", err));

// export default {pool, pool2};

import pkg from "pg";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env

const { Pool } = pkg;

// 🔗 Main User DB (e.g., 'totle')
const userDb = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 📘 Catalog DB (optional second DB)
const catalogDb = new Pool({
  connectionString: process.env.DATABASE_URL2,
});

// 🔌 Connect User DB
userDb.connect()
  .then(() => {
    console.log("✅ User DB connected!");
  })
  .catch((err) => {
    console.error("❌ User DB connection error:", err);
  });

// 🔌 Connect Catalog DB
catalogDb.connect()
  .then(() => {
    console.log("✅ Catalog DB connected!");
  })
  .catch((err) => {
    console.error("❌ Catalog DB connection error:", err);
  });

// 📤 Export both pools (named export)
export { userDb, catalogDb };