import pkg from "pg";  // Correct way to import CommonJS modules in ES Modules
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg; // Extract Pool from default import

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL Connected!"))
  .catch((err) => console.error("❌ Connection Error:", err));

export default pool;
