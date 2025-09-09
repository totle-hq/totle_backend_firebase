// src/utils/progressBus.js
import jwt from "jsonwebtoken";

/**
 * In-memory pub/sub for SSE progress by (userId, topicId).
 * One process only (works with your current setup). If you run multiple instances,
 * we can switch this to Redis pub/sub later with the same API.
 */

const channels = new Map(); // key = `${userId}:${topicId}` -> Set<Response>

/** Build a channel key */
const keyFor = (userId, topicId) => `${userId}:${topicId}`;

/** Attach an SSE client to a (userId, topicId) channel */
export function attachSseClient({ req, res, userId, topicId }) {
  const key = keyFor(userId, topicId);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // CORS (adjust to your CORS middleware if needed)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Initial ping so the client knows we’re connected
  res.write(`data: ${JSON.stringify({ phase: "connect", status: "ok", note: "SSE connected" })}\n\n`);

  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);

  // Heartbeat to keep proxies happy
  const ping = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch {
      // ignore
    }
  }, 15000);

  // Cleanup on close
  const cleanup = () => {
    clearInterval(ping);
    const set = channels.get(key);
    if (set) {
      set.delete(res);
      if (set.size === 0) channels.delete(key);
    }
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  req.on("close", cleanup);
  req.on("end", cleanup);
}

/** Publish a progress event to all listeners of (userId, topicId) */
export function publishProgress({ userId, topicId, phase, status = "progress", note = "", extra = {} }) {
  const key = keyFor(userId, topicId);
  const set = channels.get(key);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({ phase, status, note, ...extra });
  for (const res of set) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      // if write fails, the cleanup on 'close' will handle it
    }
  }
}

/** Verify JWT from ?token=... and return userId or null */
export function verifyTokenFromQuery(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id || decoded?.userId || null;
  } catch {
    return null;
  }
}
