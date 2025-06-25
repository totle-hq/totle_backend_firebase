import { createClient } from "redis";

const client = createClient();

client.connect()
  .then(() => console.log("✅ Redis connected!"))
  .catch(err => console.error("❌ Redis error:", err));
