// seeders/20250704-seed-user-department-mapping.js
export async function up(queryInterface, Sequelize) {
  const [founder] = await queryInterface.sequelize.query(
    `SELECT id FROM admin.admins WHERE email = 'founder@totle.in' LIMIT 1;`
  );

  const [tenjiku] = await queryInterface.sequelize.query(
    `SELECT id FROM admin.departments WHERE code = 'tenjiku' LIMIT 1;`
  );

  if (!founder?.length || !tenjiku?.length) {
    throw new Error('Founder or Department not found. Run required seeders first.');
  }

  await queryInterface.bulkInsert({ schema: 'admin', tableName: 'user_departments' }, [
    {
      userId: founder[0].id,
      departmentId: tenjiku[0].id,
      roleType: 'manage',
      tags: ['test_gatekeeper'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete(
    { schema: 'admin', tableName: 'user_departments' },
    null
  );
}
