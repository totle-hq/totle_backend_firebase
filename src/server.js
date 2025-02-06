import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import {userPool, catalogPool, closeDbConnections } from "./config/db.js"; // Import database connection
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js"; // ✅ Import user routes


dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000", // Allow frontend
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use("/auth", authRoutes); // Add authentication routes
app.use("/users", userRoutes);
app.use("/language")


// Test route
app.get("/", (req, res) => {
  res.send("✅ TOTLE Backend API is running!");
});

// Test database connection
// app.get("/db-test", async (req, res) => {
//   try {
//     const result = await userPool.query("SELECT NOW()");
//     res.json({ message: "✅ PostgreSQL Connected!", time: result.rows[0] });
//     const result2 = await catalogPool.query("SELECT NOW()");
//     res.json({ message: "✅ PostgreSQL Connected!", time: result2.rows[0] })
//   } catch (error) {
//     res.status(500).json({ message: "❌ Database connection error", error });
//   }
// });

const closePrismaConnections = async () => {
  await userDb.$disconnect();
  await catalogDb.$disconnect();
  console.log("✅ Prisma connections closed on server shutdown.");
};

// Handle process exit signals
process.on('SIGINT', async () => {
  console.log("\n🛑 Server shutting down...");
  await closePrismaConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("\n🛑 Server shutting down...");
  await closePrismaConnections();
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

