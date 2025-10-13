// src/utils/redisClient.js
// -----------------------------------------------------------------------------
// Redis Singleton (ioredis)
//  - Reads REDIS_URL or REDIS_CONNECTION_STRING
//  - Auto-reconnect, basic telemetry, graceful shutdown
//  - JSON helpers for convenience
// -----------------------------------------------------------------------------

import Redis from "ioredis";

let redisInstance = null;

function buildRedis() {
  const url = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
  if (!url) {
    console.warn("[Redis] No REDIS_URL/REDIS_CONNECTION_STRING provided. Continuing without Redis.");
    return null;
  }

  const client = new Redis(url, {
    lazyConnect: true,
    // tune reconnect/backoff as needed
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  client.on("connect", () => console.log("[Redis] Connected"));
  client.on("ready", () => console.log("[Redis] Ready"));
  client.on("error", (err) => console.error("[Redis] Error:", err.message));
  client.on("close", () => console.warn("[Redis] Connection closed"));
  client.on("reconnecting", () => console.warn("[Redis] Reconnecting..."));

  // Attempt connection upfront (non-fatal on failure)
  client.connect().catch((err) => {
    console.warn("[Redis] Initial connect failed:", err.message);
  });

  // Graceful shutdown
  const shutdown = async () => {
    try {
      if (client.status === "end") return;
      await client.quit();
      console.log("[Redis] Quit OK");
    } catch (e) {
      console.warn("[Redis] Quit error, forcing disconnect...");
      try {
        client.disconnect();
      } catch (_) {}
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return client;
}

/**
 * Get or create the singleton Redis client.
 */
export function getRedis() {
  if (!redisInstance) {
    redisInstance = buildRedis();
  }
  return redisInstance;
}

/** ---------------- Convenience JSON helpers ---------------- */

export async function getJSON(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function setJSON(key, value, ttlSeconds = null) {
  const r = getRedis();
  if (!r) return false;
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await r.set(key, payload, "EX", ttlSeconds);
    } else {
      await r.set(key, payload);
    }
    return true;
  } catch {
    return false;
  }
}

export async function delKey(key) {
  const r = getRedis();
  if (!r) return 0;
  try {
    return await r.del(key);
  } catch {
    return 0;
  }
}

/**
 * Utility to apply TTL to an existing key.
 */
export async function expire(key, ttlSeconds) {
  const r = getRedis();
  if (!r) return 0;
  try {
    return await r.expire(key, ttlSeconds);
  } catch {
    return 0;
  }
}
