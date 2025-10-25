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
import { registerChatHandlers } from "./socket/chat.socket.js";
import timezoneMiddleware from "./middlewares/timezone.js";

// --- CPS Generator infrastructure ---
import { registerCpsGeneratorNamespace } from "./events/cpsGeneratorEvents.js";
import { getRedis } from "./utils/redisClient.js";

import chatRoutes from "./routes/chat.routes.js";
import fs from "fs";

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
import PaidSessionRoutes from "./routes/SessionRoutes/PaidSession.routes.js";
import EndeavorRoutes from "./routes/EndeavorRoutes/Endeavor.routes.js";
import newsfeedRoutes from "./routes/newsfeed.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import cpsAdminRouter from "./routes/admin.cps.routes.js";
import researchCpsRouter from "./routes/research.cps.routes.js";
import strategyCpsRouter from "./routes/strategy.cps.routes.js";
import opsCpsRouter from "./routes/ops.cps.routes.js";
import cpsRouter from "./routes/cps.routes.js";
import testsProgressRoutes from "./routes/tests.progress.routes.js";
import nucleusDocsRoutes from "./routes/nucleusDocs.routes.js";  // ✅ import
import projectTaskRoutes from "./routes/projectTask.routes.js";
import projectBoardRoutes from "./routes/projectBoard.routes.js";
import researchRoutes from "./routes/research.routes.js";
import cpsLogsRoutes from "./routes/cpsLogs.routes.js";
import featureRoadmapRoutes from "./routes/strategy/featureRoadmap.routes.js";
import iqQuestionRoutes from "./routes/cps/iqQuestion.routes.js";
import sitemapRouter from "./routes/SiteMap/sitemap.js";

// DB sync (your existing)
import { defineModelRelationships, runDbSync, syncDatabase } from "./config/syncDb.js";
import { initCpsModels } from "./Models/Cps/index.js";

// ✅ Ensure all base models & associations are loaded exactly once at boot
import "./Models/index.js";

// ----------------------------------------
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// If you're behind ALB / Nginx, trust proxy for correct protocol/ips
app.set("trust proxy", true);

/* -------------------- CORS -------------------- */
const ORIGINS = [
  // ✅ Local development (React CRA, Vite, etc.)
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://localhost:5173",   // ✅ added
  "http://127.0.0.1:5173",   // ✅ added
  "http://localhost:4173",   // ✅ added (Vite preview)
  "http://127.0.0.1:4173",   // ✅ added

  // ✅ Production domains
  "https://totle.co",
  "https://www.totle.co",
  "https://nucleus.totle.co",
  "https://api.totle.co"
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const normalized = origin.replace(/\/$/, "");

    // ✅ Allow production + all localhost ports (CRA, Vite, etc.)
    if (
      ORIGINS.includes(normalized) ||
      /^http:\/\/localhost(:\d+)?$/.test(normalized) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(normalized)
    ) {
      return cb(null, true);
    }

    console.warn(`[CORS BLOCKED] ${origin}`);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "x-user-timezone"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use((req, _res, next) => {
  // small visibility into who is blocked by CORS
  const normalized = req.headers.origin?.replace(/\/$/, "");
  if (normalized && !ORIGINS.includes(normalized)) {
    console.warn(`[CORS] Blocked origin: ${req.headers.origin} ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.use((req, res, next) => {
  const normalized = req.headers.origin?.replace(/\/$/, "");
  if (normalized && ORIGINS.includes(normalized)) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight for all routes

/* -------------------- Security & middlewares -------------------- */
if (process.env.NODE_ENV === "development") {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );
  console.warn("⚠️  Helmet CSP disabled for local development");
} else {
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );

  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.googletagmanager.com",
          "https://checkout.razorpay.com",
          "https://connect.facebook.net",
          "https://www.facebook.com",
          "https://meet.jit.si",
          "https://aframe.io",
          "https://unpkg.com",
        ],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.googletagmanager.com",
          "https://checkout.razorpay.com",
          "https://connect.facebook.net",
          "https://www.facebook.com",
          "https://meet.jit.si",
          "https://aframe.io",
          "https://unpkg.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: [
          "'self'",
          // Your app's domains (HTTP and WebSocket)
          "https://api.totle.co",
          "https://totle.co",
          "https://nucleus.totle.co",
          "https://www.totle.co",
          "wss://api.totle.co",
          "wss://totle.co",
          "wss://nucleus.totle.co", // Added for potential WebSocket on nucleus subdomain
          // Local development
          "http://localhost:3000",
          "http://localhost:5000",
          "http://localhost:5173",
          "http://localhost:4173",
          "ws://localhost:3000",
          "ws://localhost:5000",
          "ws://localhost:5173",
          "ws://localhost:4173",
          // Stream.io endpoints (expanded to cover all regions and subdomains)
          "https://api.stream-io-api.com",
          "wss://api.stream-io-api.com",
          "https://video.stream-io-api.com",
          "wss://video.stream-io-api.com",
          "https://edge.stream-io-api.com",
          "wss://edge.stream-io-api.com",
          "https://global.stream-io-api.com",
          "wss://global.stream-io-api.com",
          "https://us-east.stream-io-api.com",
          "wss://us-east.stream-io-api.com",
          "https://us-west.stream-io-api.com",
          "wss://us-west.stream-io-api.com",
          "https://eu-west.stream-io-api.com",
          "wss://eu-west.stream-io-api.com",
          "https://ap-northeast.stream-io-api.com",
          "wss://ap-northeast.stream-io-api.com",
          "https://in.stream-io-api.com",
          "wss://in.stream-io-api.com",
          "https://stream-io-video.com",
          "wss://stream-io-video.com",
          "https://edge.stream-io-video.com",
          "wss://edge.stream-io-video.com",
          "https://global.stream-io-video.com",
          "wss://global.stream-io-video.com",
          "https://video.stream-io-video.com",
          "wss://video.stream-io-video.com",
          "https://hint.stream-io-video.com",
          "wss://hint.stream-io-video.com",
          "https://relay.stream-io-video.com",
          "wss://relay.stream-io-video.com",
          "https://turn.stream-io-video.com",
          "wss://turn.stream-io-video.com",
          "https://turn.stream-io-api.com",
          "wss://turn.stream-io-api.com",
          "https://relay.stream-io-api.com",
          "wss://relay.stream-io-api.com",
          "https://*.stream-io-api.com",
          "wss://*.stream-io-api.com",
          "https://*.stream-io-video.com",
          "wss://*.stream-io-video.com",
          // Other third-party services
          "https://www.google-analytics.com",
          "https://stats.g.doubleclick.net",
          "https://api-bdc.io",
          "https://api.bigdatacloud.net",
          "https://ipinfo.io",
          "https://api.razorpay.com",
          "https://checkout.razorpay.com",
          "https://lumberjack.razorpay.com",
          "https://rzp.io",
          "https://meet.jit.si",
          "https://aframe.io",
          "https://connect.facebook.net",
          "https://www.facebook.com",
          // Add any additional URLs identified from browser console here
          // Example: "https://new-service.com",
          // Example: "wss://new-websocket-endpoint.com",
        ],
        frameSrc: [
          "'self'",
          "https://checkout.razorpay.com",
          "https://meet.jit.si",
          "https://video.stream-io-api.com",
          "https://*.stream-io-api.com",
        ],
        objectSrc: ["'none'"],
        // Added for CSP violation reporting
        reportUri: "/csp-violation-report",
      },
    })
  );
}

// CSP violation reporting endpoint
app.post("/csp-violation-report", (req, res) => {
  console.log("CSP Violation:", JSON.stringify(req.body, null, 2));
  res.status(204).end();
});

app.use(compression());
app.use(morgan("dev"));

app.use(express.json({ limit: "50mb" }));
app.use(timezoneMiddleware);      // <= then mount the timezone reader

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

app.use("/api", departmentRoutes);

app.use("/api/nucleus-docs", nucleusDocsRoutes);

app.use("/api/teach", insights);
app.use("/api/progress", progressRoutes);

app.use("/api/nucleus", nucleusRoutes);
app.use("/api/nucleus", userMangaeRoutes);

app.use("/api/attendance", attendenceRoutes);
app.use("/api/WeekOverlay", WeekOverlayRoutes);

app.use("/catalogue", EndeavorRoutes);
app.use("/api/chat", chatRoutes);

app.use("/admin/cps", cpsAdminRouter);
app.use("/research/cps", researchCpsRouter);
app.use("/strategy/cps", strategyCpsRouter);
app.use("/ops/cps", opsCpsRouter);
app.use("/api/cps", cpsRouter);
app.use("/api/strategy/roadmap", featureRoadmapRoutes);

app.use("/api/tests/progress", testsProgressRoutes);
app.use("/api/projects", projectBoardRoutes);

app.use("/api/projects", projectTaskRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/cps/logs", cpsLogsRoutes);
app.use("/api", iqQuestionRoutes);

app.use('/api/session/paid', PaidSessionRoutes);

/* -------------------- Health / Diagnostics -------------------- */
app.get("/", (_req, res) => {
  res.send("✅ TOTLE Backend API is running!");
});

app.use("/api/sitemap", sitemapRouter);

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

// Serve React frontend only if build exists (for production)
const buildPath = path.join(__dirname, "build");
if (fs.existsSync(path.join(buildPath, "index.html"))) {
  app.use(express.static(buildPath));
  app.get("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/auth")) {
      return next();
    }
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  console.warn("⚠️  No React build found — skipping static frontend serving");
}
// ✅ Serve React frontend routes (like /teach/session/:id)
app.get("/teach/session/:id", (req, res) => {
  const buildPath = path.join(__dirname, "build");
  res.sendFile(path.join(buildPath, "index.html"));
});

// 404 for unknown API routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found", path: req.originalUrl });
});

/* -------------------- Server & Socket.IO -------------------- */
const startServer = async () => {
  try {
    // 🔹 Initialize CPS model associations BEFORE DB sync
    initCpsModels();
    console.log("✅ CPS model associations initialized");

    // 🔹 Ensure DB schema with associations known
    await runDbSync(false);
    console.log("✅ DB sync complete");

    const PORT = process.env.PORT || 5000;

    // 🔹 Initialize Redis (shared across app)
    const redis = getRedis();
    app.set("redis", redis);

    const server = http.createServer(app);

    // Socket.IO with strict CORS (must mirror HTTP CORS)
    const io = new Server(server, {
      cors: {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true); // server-to-server/no-origin
          const normalized = origin.replace(/\/$/, "");
          if (ORIGINS.includes(normalized)) return cb(null, true);
          return cb(new Error(`Socket.IO CORS blocked: ${origin}`));
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization", "Content-Type"],
        credentials: true,
      },
      allowEIO3: false, // you are on EIO=4; keep false to avoid legacy quirks
    });

    global.io = io;

    // Register chat handlers once (for all connections)
    registerChatHandlers(io);
    // 🔹 Register CPS Generator event namespace (/cps-generator)
    registerCpsGeneratorNamespace(io);

    /* -------------------------------------------------------------
       CPS OBSERVATORY LOG EMITTER  — used by all CPS pipelines
    ------------------------------------------------------------- */
    global.emitCpsLog = (log) => {
      if (!global.io) return;
      try {
        global.io.emit("cps:observatory:update", log);
        console.log("📡 [CPS OBS] →", log.type, log.status, log.batch_id || log.id);
      } catch (err) {
        console.error("❌ [CPS OBS] Emit failed:", err.message);
      }
    };

    // optional: scale horizontally via Redis pub/sub
    if (redis) {
      const sub = redis.duplicate();
      await sub.connect();
      await sub.subscribe("cps:observatory:update", (msg) => {
        try {
          const data = JSON.parse(msg);
          global.io.emit("cps:observatory:update", data);
        } catch (e) {
          console.error("[Redis→Socket] bad payload:", e.message);
        }
      });
      console.log("🔄 Redis subscriber active for cps:observatory:update");
    }

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

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running with WebSocket on port ${PORT} (LAN accessible)`);
    });
  } catch (error) {
    console.error("❌ Error during database setup or server start:", error);
  }
};

(async () => {
  await startServer();
})();