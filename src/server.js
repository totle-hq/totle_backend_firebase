// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";

// ---- Routes (your existing imports) ----
import authRoutes from "./routes/UserRoutes/auth.routes.js";
import userRoutes from "./routes/UserRoutes/user.routes.js";
import adminRoutes from "./routes/UserRoutes/admin.routes.js";
import languageRoutes from "./routes/languages.routes.js";
import catalogueRoutes from "./routes/CatalogRoutes/catalogue.routes.js";
import nucleusRoutes from "./routes/UserRoutes/Nucleus.routes.js";
import testRoutes from "./routes/test.routes.js";
import streamRoutes from "./routes/SessionStreamRoutes/stream.routes.js";
import sessionRoutes from "./routes/SessionRoutes/session.routes.js";
import paymentRoutes from "./routes/PaymentRoutes/Payment.route.js";
import teachRoutes from "./routes/teach.routes.js";
import ctaRoutes from "./routes/cta.js";
import platformCtaRoutes from "./routes/platformCta.routes.js";
import FeedbackRoutes from "./routes/feedback.routes.js";
import objectiveRoutes from "./routes/Objectives/objective.routes.js";
import progressRoutes from "./routes/progressTracker.routes.js";
import insights from "./routes/insights.routes.js";
import keyResultRoutes from "./routes/Objectives/keyresult.routes.js";
import userMangaeRoutes from "./routes/nucleus.routes.js";
import attendenceRoutes from "./routes/attendance.routes.js";
import marketplaceRoutes from "./routes/MarketplaceRoutes/marrketplace.routes.js";
import epicsRoutes from "./routes/Objectives/epic.routes.js";
import featureRoutes from "./routes/Objectives/feature.routes.js";
import taskRoutes from "./routes/Objectives/task.routes.js";
import WeekOverlayRoutes from "./routes/WeekOverlay.routes.js";
import getPaidTeacher from "./routes/SessionRoutes/PaidSession.routes.js";
import EndeavorRoutes from "./routes/EndeavorRoutes/Endeavor.routes.js";

// DB sync (your existing)
import { defineModelRelationships, syncDatabase } from "./config/syncDb.js";

// (Optional) If you use these in /db, import them; else the route will guard.
// import { userDb, catalogDb } from "./wherever/your/db/clients/are.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* -------------------- CORS -------------------- */
// Exact origins with scheme; NO trailing slashes.
const ORIGINS = [
  "https://totle.co",
  "https://www.totle.co",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  // Uncomment if you truly need these:
  // "https://totle.netlify.app",
  // "https://totlenucleus.netlify.app",
];

const corsOptions = {
  origin(origin, cb) {
    // Allow same-origin / server-to-server / health checks without Origin
    if (!origin) return cb(null, true);
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight for all routes

/* -------------------- Security & middlewares -------------------- */
// Helmet: allow cross-origin resource fetches (useful for APIs)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use("/uploads", express.static(path.resolve("src/uploads")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(compression());
app.use(morgan("dev"));

/* -------------------- Routes -------------------- */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/languages", languageRoutes);
app.use("/api/languages", languageRoutes);

app.use("/admin", adminRoutes);
app.use("/api", ctaRoutes);
app.use("/api", platformCtaRoutes);

app.use("/api/catalogue", catalogueRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/teach", teachRoutes);
app.use("/api/feedback", FeedbackRoutes);

app.use("/api/objectives", objectiveRoutes);
app.use("/api/objectives", keyResultRoutes);
app.use("/api/objectives", epicsRoutes);
app.use("/api/objectives", featureRoutes);
app.use("/api/objectives", taskRoutes);

app.use("/api/teach", insights);
app.use("/api/progress", progressRoutes);

app.use("/api/nucleus", nucleusRoutes);
app.use("/api/nucleus", userMangaeRoutes);

app.use("/api/attendance", attendenceRoutes);
app.use("/api/WeekOverlay", WeekOverlayRoutes);
app.use("/api/marketplace", getPaidTeacher);

app.use("/catalogue", EndeavorRoutes);

/* -------------------- Health endpoints -------------------- */
app.get("/", (_req, res) => {
  res.send("✅ TOTLE Backend API is running!");
});

// Optional DB check; guarded if clients are undefined.
app.get("/db", async (_req, res) => {
  try {
    if (typeof userDb?.$connect === "function") await userDb.$connect();
    if (typeof catalogDb?.$connect === "function") await catalogDb.$connect();
    res.json({ message: "✅ DB connected (if configured)" });
  } catch (error) {
    res.status(500).json({ message: "❌ Database connection error", error });
  }
});

/* -------------------- Server & Socket.IO -------------------- */
const startServer = async () => {
  try {
    // Ensure DB schema is in place
    await syncDatabase();
    // await defineModelRelationships(); // if needed

    const PORT = process.env.PORT || 5000;

    const server = http.createServer(app);

    const io = new Server(server, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      cors: {
        origin: ORIGINS,
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization", "Content-Type"],
        credentials: true,
      },
    });

    global.io = io;

    io.on("connection", (socket) => {
      console.log("🔌 WebSocket connected:", socket.id);

      // Join signaling room
      socket.on("join", ({ sessionId, userId, role }) => {
        socket.join(sessionId);
        console.log(`🟢 ${role} ${userId} joined session ${sessionId}`);
      });

      // Forward signal (offer, answer, candidate)
      socket.on("signal", ({ sessionId, userId, type, data }) => {
        console.log(`📡 Signal ${type} from ${userId} in session ${sessionId}`);
        socket.to(sessionId).emit("signal", { sessionId, userId, type, data });
      });

      // Handle hangup
      socket.on("hangup", ({ sessionId, userId }) => {
        console.log(`🔴 Hangup by ${userId} in session ${sessionId}`);
        socket.to(sessionId).emit("hangup");
      });

      socket.on("disconnect", () => {
        console.log("❌ WebSocket disconnected:", socket.id);
      });
    });

    server.listen(PORT, () =>
      console.log(`🚀 Server running with WebSocket on port ${PORT}`)
    );
  } catch (error) {
    console.error("❌ Error during database setup or server start:", error);
  }
};

(async () => {
  await startServer();
})();
