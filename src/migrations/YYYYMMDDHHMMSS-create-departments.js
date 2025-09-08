// migrations/YYYYMMDDHHMMSS-create-departments.js

export async function up(queryInterface, Sequelize) {
  const qi = queryInterface;
  const sequelize = qi.sequelize;

  // Detect schema: prefer "admin" if it exists; otherwise use default (public/search_path)
  let targetSchema = "admin";
  try {
    const schemas = await sequelize.showAllSchemas();
    const names = (Array.isArray(schemas) ? schemas : []).map((s) =>
      typeof s === "string" ? s : s?.schema_name || s?.name || Object.values(s || {})[0]
    );
    if (!names.includes("admin")) targetSchema = null;
  } catch {
    targetSchema = null;
  }

  const deptTable = targetSchema ? { tableName: "departments", schema: targetSchema } : "departments";
  const krTable = targetSchema ? { tableName: "key_results", schema: targetSchema } : "key_results";
  const qDept = targetSchema ? `"${targetSchema}"."departments"` : `"departments"`;
  const qKR = targetSchema ? `"${targetSchema}"."key_results"` : `"key_results"`;

  // Ensure uuid extension for default UUIDs
  await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  // Create Departments table
  await qi.createTable(deptTable, {
    id: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: Sequelize.literal("uuid_generate_v4()"),
      comment: "Department UUID",
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true,
      comment: "e.g., Tenjiku, Manhattan, Helix",
    },
    slug: {
      type: Sequelize.STRING(120),
      allowNull: false,
      unique: true,
      comment: "URL-safe unique key: e.g., tenjiku, manhattan, helix",
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("now") },
    updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("now") },
    deletedAt: { allowNull: true, type: Sequelize.DATE },
  });

  // Helpful unique indexes (explicit names to avoid dupes across schemas)
  const idxPrefix = targetSchema ? `${targetSchema}_` : "";
  await qi.addIndex(deptTable, ["name"], { unique: true, name: `${idxPrefix}departments_name_key` });
  await qi.addIndex(deptTable, ["slug"], { unique: true, name: `${idxPrefix}departments_slug_key` });

  // Seed 9 departments (stable UUIDs)
  const now = new Date();
  const rows = [
    { id: "6a07af05-e21f-462a-9aea-1b62801a2f99", name: "Tenjiku",    slug: "tenjiku",    description: null, createdAt: now, updatedAt: now },
    { id: "e171980b-3368-4cca-b36a-8b84e6d0a0aa", name: "Manhattan",  slug: "manhattan",  description: null, createdAt: now, updatedAt: now },
    { id: "86c53aa2-d8e7-490a-8f09-451e20020108", name: "Helix",      slug: "helix",      description: null, createdAt: now, updatedAt: now },
    { id: "1a8a68f8-679d-4ef7-a25d-17f2c7be9bc6", name: "Growth",     slug: "growth",     description: null, createdAt: now, updatedAt: now },
    { id: "703dd40f-1fc4-42c6-820b-b17aceb00af3", name: "Product",    slug: "product",    description: null, createdAt: now, updatedAt: now },
    { id: "c0121267-f419-49b1-9ccc-fa831186ad2b", name: "Engineering",slug: "engineering",description: null, createdAt: now, updatedAt: now },
    { id: "27c44b6b-6b64-4a43-95f7-859533d4528e", name: "Design",     slug: "design",     description: null, createdAt: now, updatedAt: now },
    { id: "c5d3afde-7010-45a2-9a0e-0247f6fd06ee", name: "Operations", slug: "operations", description: null, createdAt: now, updatedAt: now },
    { id: "1575c86b-2d36-4ffc-890f-a4e41827b483", name: "Finance",    slug: "finance",    description: null, createdAt: now, updatedAt: now },
  ];
  await qi.bulkInsert(deptTable, rows);

  // Clean invalid ownerDepartmentId values before adding FK
  await sequelize.query(`
    UPDATE ${qKR} kr
       SET "ownerDepartmentId" = NULL
     WHERE "ownerDepartmentId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM ${qDept} d WHERE d.id = kr."ownerDepartmentId");
  `);

  // Add FK: key_results.ownerDepartmentId -> departments.id
  await qi.addConstraint(krTable, {
    fields: ["ownerDepartmentId"],
    type: "foreign key",
    name: `${idxPrefix}fk_key_results_ownerDepartmentId_departments`,
    references: {
      table: deptTable,
      field: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
    deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE,
  });
}

export async function down(queryInterface, Sequelize) {
  const qi = queryInterface;
  const sequelize = qi.sequelize;

  let targetSchema = "admin";
  try {
    const schemas = await sequelize.showAllSchemas();
    const names = (Array.isArray(schemas) ? schemas : []).map((s) =>
      typeof s === "string" ? s : s?.schema_name || s?.name || Object.values(s || {})[0]
    );
    if (!names.includes("admin")) targetSchema = null;
  } catch {
    targetSchema = null;
  }

  const deptTable = targetSchema ? { tableName: "departments", schema: targetSchema } : "departments";
  const krTable = targetSchema ? { tableName: "key_results", schema: targetSchema } : "key_results";
  const idxPrefix = targetSchema ? `${targetSchema}_` : "";

  // Drop FK if present
  try {
    await qi.removeConstraint(krTable, `${idxPrefix}fk_key_results_ownerDepartmentId_departments`);
  } catch {}

  // Drop table
  await qi.dropTable(deptTable);
}
