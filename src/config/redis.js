// 
import { createClient } from "redis";

export const redisClient = createClient(); // Default connects to redis://localhost:6379

redisClient.connect()
  .then(() => console.log("✅ Redis connected"))
  .catch((err) => console.error("❌ Redis connection error:", err));
