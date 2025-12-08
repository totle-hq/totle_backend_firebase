// src/config/syncDb.js
import { initCpsModels } from "../Models/Cps/index.js";

import { ensureFounder } from '../controllers/UserControllers/superAdmin.controller.js';
import { insertLanguages } from '../controllers/language.controller.js';
import { Language } from '../Models/LanguageModel.js';
import { sequelize1 } from './sequelize.js';
import { Sequelize, QueryTypes } from 'sequelize';
import dotenv from 'dotenv';

import { Test } from '../Models/test.model.js';
// import { BookedSession } from '../Models/BookedSession.js';
import { SupportQueriesMasterSeeder } from '../seeders/SupportQueriesSeeder.js';
import { ProgressionThresholds } from '../Models/progressionThresholds.model.js';
import '../Models/CatalogModels/catalogueNode.model.js';
import '../Models/TeachertopicstatsModel.js';
import { KeyResult } from '../Models/Objectives/keyresult.model.js';
import { autoRolesAndDepartments } from '../controllers/UserControllers/Nucleus.controller.js';
import { Feature } from '../Models/Objectives/Feature.model.js';
import { Epic } from '../Models/Objectives/epics.model.js';
import { Task } from '../Models/Objectives/Task.model.js';
import { Teachertopicstats } from '../Models/TeachertopicstatsModel.js';
import { fixTeacherTopicStatsTier } from '../utils/marketplacefunction.js';
import { Session } from '../Models/SessionModel.js';
import { CpsProfile } from '../Models/CpsProfile.model.js';
import { TestItemRubric } from '../Models/TestItemRubric.model.js';
import { Payment } from '../Models/PaymentModels.js';
import { User } from '../Models/UserModels/UserModel.js';
import { Department } from '../Models/UserModels/Department.js';
import { FeatureRoadmap } from '../Models/Strategy/FeatureRoadmap.model.js';
import { ProjectBoard } from "../Models/ProjectModels/ProjectBoard.model.js";
import { ProjectTask } from "../Models/ProjectModels/ProjectTask.model.js";
import { UserDevice } from "../Models/UserModels/userDevice.model.js";

dotenv.config();

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

// Tables we must NOT alter online (have many FKs / prod data)
const ALTER_BLACKLIST = new Set([
  'Session',                // user.sessions → many FKs (your crash)
  // If you later import the model for learner feedback, add it here:
  // 'LearnerSessionFeedback',
]);

async function createSchemas(sequelize) {
  // ✅ Added 'cps' schema without removing existing ones
  const schemas = ['admin', 'user', 'catalog', 'cps'];
  for (const schema of schemas) {
    try {
      await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      console.log(`✅ Schema '${schema}' created or already exists.`);
    } catch (error) {
      console.error(`❌ Failed to create schema '${schema}':`, error.message);
    }
  }
  console.log("✅ All schemas verified: admin, user, catalog, cps");
}

async function createSuperAdminIfNeeded() {
  try {
    const [results] = await sequelize1.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'admin'"
    );

    if (results.length > 0) {
      console.log('✅ Admin schema exists');
      await ensureFounder();
    } else {
      console.log('❌ Admin schema does not exist');
    }
  } catch (error) {
    console.error('Error checking admin schema:', error);
  }
}

async function insertLanguagesIfNeeded() {
  try {
    const languagesExist = await Language.count();
    if (languagesExist === 0) {
      console.log('✅ Inserting default languages');
      await insertLanguages();
    } else {
      console.log('✅ Languages already exist');
    }
  } catch (error) {
    console.error('Error inserting languages:', error);
  }
}

async function createDatabaseIfNeeded(dbName) {
  try {
    const sequelizeRoot = new Sequelize('postgres', process.env.DB_USER, process.env.DB_PASSWORD, {
      host: process.env.DB_HOST,
      dialect: 'postgres',
      logging: false,
    });

    const [results] = await sequelizeRoot.query(
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`,
      { type: QueryTypes.SELECT }
    );

    if (!results) {
      console.log(`✅ Database "${dbName}" does not exist. Creating it...`);
      await sequelizeRoot.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    } else {
      console.log(`✅ Database "${dbName}" already exists.`);
    }

    await sequelizeRoot.close();
  } catch (error) {
    console.error('❌ Error creating database:', error);
  }
}

// Associations bootstrap (unchanged signature)
export async function defineModelRelationships() {
  const defineRelationships = await import('../config/associations.js');
  defineRelationships.default();
  console.log('✅ Sequelize model associations initialized');
}

/**
 * Safely sync a model:
 * - Uses alter: true by default
 * - Disables alter for models in ALTER_BLACKLIST
 * - Auto-falls back to non-alter if Postgres blocks a destructive change (e.g., cannot DROP COLUMN due to FKs)
 */
async function safeSync(model, { name, allowAlter = true } = {}) {
  const modelName = name || model?.name || model?.options?.name?.singular || 'Model';
  try {
    if (!allowAlter || ALTER_BLACKLIST.has(modelName)) {
      await model.sync(); // no alter
      console.log(`✅ ${modelName} synced (no alter)`);
    } else {
      await model.sync({ alter: true });
      console.log(`✅ ${modelName} synced with alter`);
    }
  } catch (err) {
    const msg = String(err?.message || '');
    const code = err?.parent?.code;
    if (msg.includes('cannot drop column') || code === '2BP01') {
      console.warn(`⚠️  ${modelName}: alter failed due to dependencies; retrying without alter…`);
      await model.sync();
      console.log(`✅ ${modelName} synced after fallback (no alter)`);
      return;
    }
    console.error(`❌ ${modelName} sync error:`, err);
    throw err;
  }
}

/* -------------------------------------------------
   Main Sync
-------------------------------------------------- */
export async function syncDatabase() {
    console.log("🟡 syncDatabase() invoked"); // 👈 add this at the top

  try {
    const dbName1 = process.env.DB_NAME || 'totle';
    console.log("🟡 creating DB if needed:", dbName1); // 👈

    await createDatabaseIfNeeded(dbName1);
    console.log("🟢 Database check done"); // 👈 add this

    await createSchemas(sequelize1); // ✅ now includes 'cps'
initCpsModels();

    // associations
    const defineRelationships = await import('../config/associations.js');
    defineRelationships.default();
    console.log('✅ Model associations defined!');

    console.log('🔄 Syncing tables in the correct order...');
    console.log('🔍 Ensuring enum values exist for catalog.enum_teacher_topic_stats_tier...');

    const { Admin } = await import('../Models/UserModels/AdminModel.js');
    await safeSync(Admin, { name: 'Admin' });
    await safeSync(Language, { name: "Language" }); 
    await safeSync(User, { name: 'User'});
    await safeSync(UserDevice, {name: 'UserDevice'});
    console.log(" User Device synced successfully!");
    await safeSync(SessionToken, {name: 'SessionToken'});
    console.log('✅ Session Token table synced successfully!');

    const { Blog } = await import('../Models/SurveyModels/BlogModel.js');
    await safeSync(Blog, { name: 'Blog' });

    const { Objective } = await import('../Models/Objectives/objective.model.js');
    await safeSync(Objective, { name: 'Objective' });
    console.log('✅ Objective table synced successfully!');

    await safeSync(FeatureRoadmap, { name: 'FeatureRoadmap' });
    console.log('✅ FeatureRoadmap table synced successfully!');

    await safeSync(KeyResult, { name: 'KeyResult' });
    console.log('✅ KeyResult table synced successfully!');

    await safeSync(Epic, { name: 'Epic' });
    console.log('✅ Epics table synced successfully!');

    await safeSync(Feature, { name: 'Feature' });
    console.log('✅ Feature table synced successfully!');

    await safeSync(Task, { name: 'Task' });
    console.log('✅ Task table synced successfully!');

    await safeSync(ProjectBoard, { name: "ProjectBoard" });
    console.log("✅ ProjectBoard table synced successfully!");

    await safeSync(ProjectTask, { name: "ProjectTask" });
    console.log("✅ ProjectTask table synced successfully!");

    const { Survey } = await import('../Models/SurveyModels/SurveyModel.js');
    await safeSync(Survey, { name: 'Survey' });

    const { Question } = await import('../Models/SurveyModels/QuestionModel.js');
    await safeSync(Question, { name: 'Question' });

    const { CatalogueNode } = await import('../Models/CatalogModels/catalogueNode.model.js');
    await safeSync(CatalogueNode, { name: 'CatalogueNode' });
    await safeSync(TeacherAvailability, { name: 'TeacherAvailability' });
    console.log('✅ TeacherAvailability table synced successfully!');
    await Department.sync({ alter: true });


  // ✅ Sync CPS profiles under cps schema (permanent deep fix, schema-level isolation)
console.log("🧠 Preparing CPS schema and enums before syncing CpsProfile...");

try {
  // 1️⃣ Ensure cps schema exists (never assume public)
  await sequelize1.query(`CREATE SCHEMA IF NOT EXISTS "cps"`);
  console.log("✅ 'cps' schema verified or created.");

  // 2️⃣ Drop *every* duplicate enum across all schemas — root cause of 21000 error
  await sequelize1.query(`
    DO $$
    DECLARE
      rec RECORD;
    BEGIN
      -- Drop same-named enums across every namespace
      FOR rec IN
        SELECT n.nspname AS schema_name, t.typname
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'enum_cps_cps_profiles_context_type'
      LOOP
        EXECUTE format('DROP TYPE IF EXISTS "%I"."%I" CASCADE;', rec.schema_name, rec.typname);
      END LOOP;

      -- Drop global (unqualified) version if it still exists
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cps_cps_profiles_context_type') THEN
        EXECUTE 'DROP TYPE "enum_cps_cps_profiles_context_type" CASCADE;';
      END IF;
    END $$;
  `);
  console.log("🧹 All enum_cps_cps_profiles_context_type variants dropped globally.");

  // 3️⃣ Force recreate cps.cps_profiles cleanly
  await sequelize1.query(`DROP TABLE IF EXISTS "cps"."cps_profiles" CASCADE;`);
  console.log("🗑️ Dropped any stale cps_profiles table.");

  await CpsProfile.sync({ force: true });
  console.log("✅ Recreated cps.cps_profiles table successfully (force sync).");
} catch (err) {
  console.error("❌ CpsProfile sync section failed hard:", err.message);
}

    await safeSync(ProgressionThresholds, { name: 'ProgressionThresholds' });
    console.log('✅ ProgressionThresholds table synced successfully!');

    await safeSync(Session, { name: 'Session', allowAlter: false });

    await safeSync(Payment, { name: "Payment" });  
    await safeSync(Test, { name: "Test" });
    await safeSync(TestItemRubric, { name: "TestItemRubric" });

    await sequelize1.sync();
    console.log('✅ All tables synced successfully!');

    await insertLanguagesIfNeeded();
    await SupportQueriesMasterSeeder();
    await createSuperAdminIfNeeded();
    await autoRolesAndDepartments();
    await fixTeacherTopicStatsTier();

  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
}

export const runDbSync = async (isSyncNeeded = false) => {
  if (isSyncNeeded) {
    console.log("⚙️ Running full DB sync...");
    await syncDatabase();
  } else {
    console.log("🔗 Defining model relationships only...");
    await defineModelRelationships();
  }
};

import path from "path";
import url from "url";
import TeacherAvailability from "../Models/TeacherAvailability.js";
import { SessionToken } from "../Models/SessionTokenModel.js";

const thisFile = url.fileURLToPath(import.meta.url);
const entryFile = path.resolve(process.argv[1] || "");

if (thisFile === entryFile) {
  console.log("⚙️ Running direct DB sync...");
  syncDatabase()
    .then(() => {
      console.log("✅ Database synced successfully!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Database sync failed:", err);
      process.exit(1);
    });
}
