// src/config/syncDb.js
import { ensureFounder } from '../controllers/UserControllers/superAdmin.controller.js';
import { insertLanguages } from '../controllers/language.controller.js';
import { Language } from '../Models/LanguageModel.js';
import { sequelize1 } from './sequelize.js';
import { Sequelize, QueryTypes } from 'sequelize';
import dotenv from 'dotenv';

import { Test } from '../Models/test.model.js';
import { BookedSession } from '../Models/BookedSession.js';
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
  const schemas = ['admin', 'user', 'catalog'];
  for (const schema of schemas) {
    try {
      await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      console.log(`✅ Schema '${schema}' created or already exists.`);
    } catch (error) {
      console.error(`❌ Failed to create schema '${schema}':`, error.message);
    }
  }
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
    // When Sequelize tries to drop a PK/column with FKs → 2BP01 (your crash)
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
  try {
    const dbName1 = process.env.DB_NAME || 'totle';

    await createDatabaseIfNeeded(dbName1);
    await createSchemas(sequelize1);

    // associations
    const defineRelationships = await import('../config/associations.js');
    defineRelationships.default();
    console.log('✅ Model associations defined!');

    /* ---------------------------------------------
       DO NOT run global alter for entire DB.
       (This was causing DROP COLUMN on user.sessions.id)
    ---------------------------------------------- */

    // If you still want a broad pass for new tables ONLY, you can do:
    // await sequelize1.sync(); // no alter
    // But we’ll rely on explicit, ordered syncs below.

    console.log('🔄 Syncing tables in the correct order...');

    // Keep your earlier fix/ordering for marketplace enum/table:
    console.log('🔍 Ensuring enum values exist for catalog.enum_teacher_topic_stats_tier...');
    

    // Blog/Survey/Admin/etc. (dynamic imports preserved)
    const { Admin } = await import('../Models/UserModels/AdminModel.js');
    await safeSync(Admin, { name: 'Admin' });
    await safeSync(Language, { name: "Language" }); 
    await safeSync(User, { name: 'User'});

    const { Blog } = await import('../Models/SurveyModels/BlogModel.js');
    await safeSync(Blog, { name: 'Blog' });

    const { Objective } = await import('../Models/Objectives/objective.model.js');
    await safeSync(Objective, { name: 'Objective' });
    console.log('✅ Objective table synced successfully!');

    await safeSync(KeyResult, { name: 'KeyResult' });
    console.log('✅ KeyResult table synced successfully!');

    await safeSync(Epic, { name: 'Epic' });
    console.log('✅ Epics table synced successfully!');

    await safeSync(Feature, { name: 'Feature' });
    console.log('✅ Feature table synced successfully!');

    await safeSync(Task, { name: 'Task' });
    console.log('✅ Task table synced successfully!');

    const { Survey } = await import('../Models/SurveyModels/SurveyModel.js');
    await safeSync(Survey, { name: 'Survey' });

    const { Question } = await import('../Models/SurveyModels/QuestionModel.js');
    await safeSync(Question, { name: 'Question' });

    // await safeSync(Test, { name: 'Test' });

    const { CatalogueNode } = await import('../Models/CatalogModels/catalogueNode.model.js');
    await safeSync(CatalogueNode, { name: 'CatalogueNode' });

    await Department.sync({ alter: true });

    await safeSync(BookedSession, { name: 'BookedSession' });
    await safeSync(CpsProfile, { name: "CpsProfile" });

    await safeSync(ProgressionThresholds, { name: 'ProgressionThresholds' });
    console.log('✅ ProgressionThresholds table synced successfully!');

    // 🚫 Sessions is blacklisted (no alter)
    await safeSync(Session, { name: 'Session', allowAlter: false });

    // DO NOT call sequelize1.sync({ alter: true }) again here.
    // If you want a final "create missing only" pass:
    await safeSync(Payment, { name: "Payment" });  // 👈 add this before Test
    await safeSync(Test, { name: "Test" });
    await safeSync(TestItemRubric, { name: "TestItemRubric" });


    await sequelize1.sync();

    console.log('✅ All tables synced successfully!');

    // Seeders / bootstrap
    await insertLanguagesIfNeeded();
    await SupportQueriesMasterSeeder();
    await createSuperAdminIfNeeded();
    await autoRolesAndDepartments();
    await fixTeacherTopicStatsTier();

  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
}
