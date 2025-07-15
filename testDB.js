import { createClient } from "redis";

const client = createClient();

client.connect()
  .then(() => console.log("✅ Redis connected!"))
  .catch(err => console.error("❌ Redis error:", err));
/*const path = require('path');

module.exports = {
  'config': path.resolve(__dirname, 'src/config', 'config.js'),
  'models-path': path.resolve(__dirname, 'src/Models'),
  'migrations-path': path.resolve(__dirname, 'src/migrations'),
  'seeders-path': path.resolve(__dirname, 'src/seeders'),
};
*/