// import { catalogDb, userDb } from "./src/config/prismaClient.js";

// async function testDB() {
//   try {
//     // Check connection without fetching data
//     await userDb.$connect();
//     console.log("✅ Connected to User Database");

//     await catalogDb.$connect();
//     console.log("✅ Connected to Catalog Database");
//   } catch (error) {
//     console.error("❌ Database connection error:", error);
//   } finally {
//     // Close connections
//     await userDb.$disconnect();
//     await catalogDb.$disconnect();
//     console.log("✅ Prisma connections closed.");
//   }
// }

// Run the connection test
// testDB();
// const jwt = require('jsonwebtoken');
import jwt from 'jsonwebtoken';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4NWYwMzBjLWFhZTktNGU1Yy1iZmY3LTk1YmJiMjk2NmRmYSIsImVtYWlsIjoiMjQ5M3NhaWNoYXJhbkBnbWFpbC5jb20iLCJ1c2VyTmFtZSI6IlNhaSIsImlhdCI6MTc0MTAwMTkxNCwiZXhwIjoxNzQxNjA2NzE0fQ.Z9EN1S6GnFIMkHqOJ6UZFoCK4mp53UNt1PfrXzI1OOs";
const secretKey = "sriragh-manohar-arif-vyshu-nikhila"; // Use the actual secret key

try {
    const decoded = jwt.verify(token, secretKey);
    console.log(decoded); // Prints payload if the token is valid
} catch (err) {
    console.error("Invalid token:", err.message);
}

