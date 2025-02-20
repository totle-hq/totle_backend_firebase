import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
// import {userPool, catalogPool, closeDbConnections } from "./config/db.js"; // Import database connection
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js"; // ✅ Import user routes
import sessionRoutes from "./routes/session.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import languageRoutes from './routes/languages.routes.js'
import { catalogDb, userDb } from "./config/prismaClient.js";
import authMiddleware from "./middlewares/authMiddleware.js";
// import { getLanguages } from "./controllers/language.controller.js";
import { createServer } from "http";
import { Server } from "socket.io";


dotenv.config();

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(express.json());
app.use(cors({
  origin: ['https://www.totle.co', 'https://mail.google.com', 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(helmet());

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinSession", (sessionId) => {
    socket.join(sessionId);
    console.log(`User joined session: ${sessionId}`);
  });

  socket.on("sessionUpdate", (sessionId, status) => {
    io.to(sessionId).emit("sessionStatusChanged", status);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.use(compression());
app.use(morgan("dev"));
app.use("/auth", authRoutes); // Add authentication routes
app.use("/users", userRoutes);
app.use("/languages", languageRoutes);
app.use("/api/languages", languageRoutes); // ✅ Register the languages route
app.use("/session", authMiddleware, sessionRoutes);
app.use("/admin", adminRoutes);



// Test route
app.get("/", (req, res) => {
  res.send("✅ TOTLE Backend API is running!");
});
async function insertLanguages() {
  const languages = [
    "Assamese", "Bengali", "Bodo", "Dogri", "English",
    "Gujarati", "Hindi", "Kannada", "Kashmiri", "Konkani",
    "Maithili", "Malayalam", "Manipuri", "Marathi", "Nepali",
    "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi",
    "Tamil", "Telugu", "Urdu", "Bhili", "Gondi", "Tulu"
  ];

  try {
    await userDb.language.createMany({
      data: languages.map((lang) => ({ language_name: lang })),
      skipDuplicates: true, // Prevents inserting duplicates
    });

    console.log("✅ All Indian languages inserted successfully!");
  } catch (error) {
    console.error("❌ Error inserting languages:", error);
  } finally {
    await userDb.$disconnect();
  }
}

// Run the function
// insertLanguages();

// Test database connection
app.get("/db", async (req, res) => {
  try {
    // const result = await userPool.query("SELECT NOW()");
    await userDb.$connect();
    // res.json({ message: "✅ user db Connected!" });
    await catalogDb.$connect();
    res.json({ message: "✅ user db and catalog db Connected!"})
  } catch (error) {
    res.status(500).json({ message: "❌ Database connection error", error });
  }
});

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

