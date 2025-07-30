import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

export const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        tls: true, // Needed for Upstash or cloud Redis
        rejectUnauthorized: false,
      },
    })
  : null;

if (redisClient) {
  redisClient.connect()
    .then(() => console.log("✅ Redis connected"))
    .catch((err) => console.error("❌ Redis connection error:", err));
} else {
  console.warn("⚠️ REDIS_URL not set. Redis client not initialized.");
}
