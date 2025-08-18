// This file is Online Redis
// For Local Redis, you can comment out the code block below and uncomment the local Redis client code.
// import { createClient } from "redis";

// const redisUrl = process.env.REDIS_URL;

// export const redisClient = redisUrl
//   ? createClient({
//       url: redisUrl,
//       socket: {
//         tls: true, // Needed for Upstash or cloud Redis
//         rejectUnauthorized: false,
//       },
//     })
//   : null;

// if (redisClient) {
//   redisClient.connect()
//     .then(() => console.log("✅ Redis connected"))
//     .catch((err) => console.error("❌ Redis connection error:", err));
// } else {
//   console.warn("⚠️ REDIS_URL not set. Redis client not initialized.");
// }

// Uncomment the following lines if you want to use a local Redis instance
// If you want to use a local Redis instance, you can uncomment the lines below
// and comment out the above code block.

import { createClient } from "redis";

export const redisClient = createClient(); // Default connects to redis://localhost:6379

redisClient.connect()
  .then(() => console.log("✅ Redis connected"))
  .catch((err) => console.error("❌ Redis connection error:", err));
