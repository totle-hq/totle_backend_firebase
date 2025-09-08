// scripts/db/check_cps_profiles.mjs
import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

const sequelize = new Sequelize({
  database: process.env.DB_NAME || "totle",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_SSL === "true" ? { require: true, rejectUnauthorized: false } : false,
  },
});

async function run() {
  console.log("🔌 Connecting…");
  await sequelize.authenticate();
  console.log("✅ Connected.");

  // Is schema "user" present?
  const [schemas] = await sequelize.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name='user'`
  );
  console.log(`📁 Schema "user": ${schemas.length ? "FOUND" : "MISSING"}`);

  // Is table in schema "user"?
  const [tUser] = await sequelize.query(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema='user' AND table_name='cps_profiles'`
  );
  const userHasTable = tUser.length > 0;
  console.log(`📄 Table user.cps_profiles: ${userHasTable ? "FOUND" : "NOT FOUND"}`);

  // If not in "user", check "public" just in case
  if (!userHasTable) {
    const [tPublic] = await sequelize.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_schema='public' AND table_name='cps_profiles'`
    );
    console.log(`📄 Table public.cps_profiles: ${tPublic.length ? "FOUND" : "NOT FOUND"}`);
  }

  // Row count (only if table exists in "user")
  if (userHasTable) {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*)::int AS cnt FROM "user"."cps_profiles"`
    );
    console.log(`🔢 Rows in user.cps_profiles: ${rows[0].cnt}`);
  }

  await sequelize.close();
  console.log("🏁 Done.");
}

run().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
