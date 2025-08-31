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
import newsfeedRoutes from "./routes/newsfeed.routes.js";

// DB sync (your existing)
import { defineModelRelationships, syncDatabase } from "./config/syncDb.js";

// ----------------------------------------
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// If you're behind ALB / Nginx, trust proxy for correct protocol/ips
app.set("trust proxy", true);

/* -------------------- CORS -------------------- */
// Exact origins with scheme; NO trailing slashes.
const ORIGINS = [
  "https://totle.co",
  "https://www.totle.co",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://nucleus.totle.co", 
];

// Build a CORS validator that returns a single allowed origin (not '*')
const corsOptions = {
  origin(origin, cb) {
    // Allow same-origin / server-to-server / health checks (no Origin header)
    if (!origin) return cb(null, true);
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use((req, _res, next) => {
  // small visibility into who is blocked by CORS
  if (req.headers.origin && !ORIGINS.includes(req.headers.origin)) {
    console.warn(`[CORS] Blocked origin: ${req.headers.origin} ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight for all routes

/* -------------------- Security & middlewares -------------------- */
app.use(
  helmet({
    // API serves cross-origin; disable CORP so assets/JSON aren't blocked
    crossOriginResourcePolicy: false,
    // Avoid COEP/COOP breakage unless you explicitly need them
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(morgan("dev"));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Static files if you serve any uploads
app.use("/uploads", express.static(path.resolve("src/uploads")));

/* -------------------- Routes -------------------- */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/languages", languageRoutes);
app.use("/api/languages", languageRoutes); // kept as in your file

app.use("/admin", adminRoutes);
app.use("/api", ctaRoutes);
app.use("/api", platformCtaRoutes);
app.use("/api/newsfeed", newsfeedRoutes);

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

/* -------------------- Health / Diagnostics -------------------- */
app.get("/", (_req, res) => {
  res.send("✅ TOTLE Backend API is running!");
});

// Basic healthz for ALB/Nginx target group checks
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// Optional DB check; guarded if clients are undefined (kept pattern)
app.get("/db", async (_req, res) => {
  try {
    if (typeof userDb?.$connect === "function") await userDb.$connect();
    if (typeof catalogDb?.$connect === "function") await catalogDb.$connect();
    res.json({ message: "✅ DB connected (if configured)" });
  } catch (error) {
    res.status(500).json({ message: "❌ Database connection error", error });
  }
});

// 404 for unknown routes (keep after all routes)
app.use((req, res) => {
  res.status(404).json({ message: "Route not found", path: req.originalUrl });
});

/* -------------------- Server & Socket.IO -------------------- */
const startServer = async () => {
  try {
    // Ensure DB schema is in place
    // await syncDatabase();
    await defineModelRelationships(); // if needed

    const PORT = process.env.PORT || 5000;

    const server = http.createServer(app);

    // Socket.IO with strict CORS (must mirror HTTP CORS)
    const io = new Server(server, {
      path: "/socket.io",
      transports: ["websocket", "polling"], // client sends EIO=4 polling fallback
      cors: {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true); // server-to-server/no-origin
          if (ORIGINS.includes(origin)) return cb(null, true);
          return cb(new Error(`Socket.IO CORS blocked: ${origin}`));
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization", "Content-Type"],
        credentials: true,
      },
      // Helpful behind proxies/ALB
      allowEIO3: false, // you are on EIO=4; keep false to avoid legacy quirks
    });

    global.io = io;

    io.on("connection", (socket) => {
      console.log("🔌 WebSocket connected:", socket.id);

      // Join signaling room
      socket.on("join", ({ sessionId, userId, role }) => {
        if (!sessionId) return;
        socket.join(sessionId);
        console.log(`🟢 ${role ?? "user"} ${userId ?? ""} joined session ${sessionId}`);
      });

      // Forward signal (offer, answer, candidate)
      socket.on("signal", ({ sessionId, userId, type, data }) => {
        if (!sessionId) return;
        console.log(`📡 Signal ${type} from ${userId ?? "unknown"} in ${sessionId}`);
        socket.to(sessionId).emit("signal", { sessionId, userId, type, data });
      });

      // Handle hangup
      socket.on("hangup", ({ sessionId, userId }) => {
        if (!sessionId) return;
        console.log(`🔴 Hangup by ${userId ?? "unknown"} in ${sessionId}`);
        socket.to(sessionId).emit("hangup");
      });

      socket.on("disconnect", (reason) => {
        console.log(`❌ WebSocket disconnected: ${socket.id} (${reason})`);
      });
    });

    // Process-level safety nets
    process.on("unhandledRejection", (err) => {
      console.error("UnhandledRejection:", err);
    });
    process.on("uncaughtException", (err) => {
      console.error("UncaughtException:", err);
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server running with WebSocket on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error during database setup or server start:", error);
  }
};

(async () => {
  await startServer();
})();
