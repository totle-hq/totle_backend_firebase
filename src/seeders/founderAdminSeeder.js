// seeders/20250704-seed-founder-admin.js
import bcrypt from 'bcrypt';

export async function up(queryInterface, Sequelize) {
  const hashedPassword = await bcrypt.hash('Founder@123', 10); // Change password in production

  await queryInterface.bulkInsert({ schema: 'admin', tableName: 'admins' }, [
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'TOTLE Founder',
      email: 'founder@totle.in',
      password: hashedPassword,
      global_role: 'Founder',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete(
    { schema: 'admin', tableName: 'admins' },
    { email: 'founder@totle.in' }
  );
}
