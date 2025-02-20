import pkg from "pg";  // Correct way to import CommonJS modules in ES Modules
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg; // Extract Pool from default import

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const pool2 = new Pool({
  connectionString: process.env.DATABASE_URL2,
})

pool
  .connect()
  .then(() => {
    console.log("✅ PostgreSQL Connected!")
  })
  .catch((err) => console.error("❌ Connection Error:", err));

pool2.connect()
  .then(() => {
    console.log("Catalog db connected!")
  })
  .catch(err=> console.log("Catalog db connection error:", err));

export default {pool, pool2};
