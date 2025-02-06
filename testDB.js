import { catalogDb, userDb } from "./src/config/prismaClient.js";

async function testDB() {
  try {
    // Check connection without fetching data
    await userDb.$connect();
    console.log("✅ Connected to User Database");

    await catalogDb.$connect();
    console.log("✅ Connected to Catalog Database");
  } catch (error) {
    console.error("❌ Database connection error:", error);
  } finally {
    // Close connections
    await userDb.$disconnect();
    await catalogDb.$disconnect();
    console.log("✅ Prisma connections closed.");
  }
}

// Run the connection test
testDB();
