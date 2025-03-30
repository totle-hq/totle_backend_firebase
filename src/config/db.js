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

dotenv.config();

const { Pool } = pkg;

// 🧠 User DB
const userDb = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 📘 Catalogue DB
const catalogDb = new Pool({
  connectionString: process.env.DATABASE_URL2,
});

// 🔌 Connect user DB
userDb.connect()
  .then(() => {
    console.log("✅ User DB connected!");
  })
  .catch((err) => console.error("❌ User DB connection error:", err));

// 🔌 Connect catalogue DB
catalogDb.connect()
  .then(() => {
    console.log("✅ Catalogue DB connected!");
  })
  .catch((err) => console.error("❌ Catalogue DB connection error:", err));

// ✅ Named exports
export { userDb, catalogDb };
