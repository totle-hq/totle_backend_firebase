// src/config/redis.js
import { createClient } from "redis";

const DISABLED = String(process.env.REDIS_DISABLED || "").toLowerCase() === "true";
const url = process.env.REDIS_URL;              // e.g. redis://127.0.0.1:6379  or  rediss://<upstash-host>:6379
const forceTLS = String(process.env.REDIS_TLS || "").toLowerCase() === "true";
const rejectUnauthorized = String(process.env.REDIS_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true";

let redisClient = null;

if (!DISABLED && url) {
  const isSecure = url.startsWith("rediss://") || forceTLS;
  redisClient = createClient({
    url,
    socket: isSecure
      ? { tls: true, rejectUnauthorized }
      : { tls: false },
  });

  redisClient.on("connect", () => {
    const mode = isSecure ? "TLS" : "no-TLS";
    console.log(`✅ Redis connected (${mode}) @ ${url}`);
  });

  redisClient.on("error", (err) => {
    console.error("❌ Redis error:", err.message || err);
  });

  // simple backoff logger if you ever add retry_strategy
  redisClient.on("reconnecting", () => console.log("↻ Redis reconnecting…"));

  try {
    await redisClient.connect();
  } catch (e) {
    console.error("❌ Redis connect() failed:", e.message || e);
  }
} else {
  const reason = DISABLED ? "disabled via REDIS_DISABLED=true" : "REDIS_URL not set";
  console.warn(`⚠️ Redis client not initialized (${reason}).`);
}

export { redisClient };
