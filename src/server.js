import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import authRoutes from "./routes/UserRoutes/auth.routes.js";
import userRoutes from "./routes/UserRoutes/user.routes.js"; // ✅ Import user routes
import adminRoutes from "./routes/UserRoutes/admin.routes.js";
import languageRoutes from './routes/languages.routes.js'
import catalogueRoutes from './routes/CatalogRoutes/catalogue.routes.js'; // ✅ Catalogue API
import sessionRoutes from "./routes/session.routs.js";
// import gradeRoutes from './routes/CatalogRoutes/grade.routes.js';
// import boardRoutes from './routes/CatalogRoutes/board.routes.js';
// import educationRoutes from './routes/CatalogRoutes/education.routes.js';
// import categoryRoutes from './routes/CatalogRoutes/category.routes.js';
// import authMiddleware from "./middlewares/authMiddleware.js";
// import { getLanguages } from "./controllers/language.controller.js";
// import { createServer } from "http";
// import { Server } from "socket.io";

import path from "path";
import { fileURLToPath } from "url";
import {defineModelRelationships, syncDatabase} from './config/syncDb.js';
import testRoutes from "./routes/test.routes.js";
import streamRoutes from "./routes/SessionStreamRoutes/stream.routes.js";
// import sessionRoutes from "./routes/SessionRoutes/session.routes.js";
import paymentRoutes from "./routes/PaymentRoutes/Payment.route.js";
//import sessionRoutes from './routes/sessionRoutes.js';
import http from "http";
import { Server } from "socket.io";
import teachRoutes from "./routes/teach.routes.js"
import ctaRoutes from "./routes/cta.js"
import platformCtaRoutes from "./routes/platformCta.routes.js";
import FeedbackRoutes from "./routes/feedback.routes.js";
// import teachRoutes from "./routes/teach.routes.js"
// import ctaRoutes from "./routes/cta.js"
// import platformCtaRoutes from "./routes/platformCta.routes.js";
// import FeedbackRoutes from "./routes/feedback.routes.js";
import objectiveRoutes from './routes/Objectives/objective.routes.js'; // adjust path if necessary
import progressRoutes from "./routes/progressTracker.routes.js";
import insights from "./routes/insights.routes.js"

// After other `app.use` statements for /api/*

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();


app.use("/uploads", express.static(path.resolve("src/uploads")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors({
  origin: ['totle.co','www.totle.co','totle.co/','https://totle.co','www.totle.co/','https://www.totle.co/','https://www.totle.co', 'https://mail.google.com', 'http://localhost:3001', 'http://localhost:3000','http://localhost:5173'],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(helmet());

app.use(compression());
app.use(morgan("dev"));
app.use("/auth", authRoutes); 
app.use("/users", userRoutes);
app.use("/languages", languageRoutes);
app.use("/api/languages", languageRoutes);
app.use("/admin", adminRoutes);
app.use('/api', ctaRoutes);
app.use("/api", platformCtaRoutes);
app.use("/api/catalogue", catalogueRoutes);
//<<<<<<< HEAD
app.use("/api/tests", testRoutes); // ✅ expose test endpoints
app.use("/api/stream", streamRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/session",sessionRoutes);
app.use("/api/teach",teachRoutes);

app.use("/api/feedback",FeedbackRoutes);

app.use("/api/teach",teachRoutes);

app.use("/api/feedback",FeedbackRoutes);
app.use('/api/objectives', objectiveRoutes);

app.use("/api/teach",insights);
app.use("/api/progress",progressRoutes);


app.get("/", (req, res) => {
  res.send("✅ TOTLE Backend API is running!");
});
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

const startServer = async () => {
  try {
    // Step 1: Run the syncDatabase function to set up the database before starting the server
     await syncDatabase();  // Automatically run the syncDatabase on server start

    // Step 2: Once syncDatabase has finished, start the server
    const PORT = process.env.PORT || 5000;
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: [
          'totle.co','www.totle.co','totle.co/','https://totle.co','www.totle.co/','https://www.totle.co/','https://www.totle.co',
          'https://mail.google.com','http://localhost:3001','http://localhost:3000'
        ],
        credentials: true,
        allowedHeaders: ["Authorization", "Content-Type"]
      }
    });
    global.io = io;

    io.on("connection", (socket) => {
      console.log("🔌 WebSocket connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("❌ WebSocket disconnected:", socket.id);
        // Optionally: emit isLoggedIn: false if user mapping is added
      });
    });

    server.listen(PORT, () => console.log(`🚀 Server running with WebSocket on port ${PORT}`));

  } catch (error) {
    console.error("❌ Error during database setup or server start:", error);
  }
};
// Call the async startServer function using an immediately invoked function expression (IIFE)
(async () => {
  await startServer(); // Call async function to start server after database setup
})();
