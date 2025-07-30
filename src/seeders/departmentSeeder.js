// seeders/20250704-seed-departments.js
export async function up(queryInterface, Sequelize) {
  await queryInterface.bulkInsert({ schema: 'admin', tableName: 'departments' }, [
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Tenjiku',
      code: 'tenjiku',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Manhattan',
      code: 'manhattan',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Helix',
      code: 'helix',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Sentinel',
      code: 'sentinel',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Echo',
      code: 'echo',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Kyoto',
      code: 'kyoto',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Vault',
      code: 'vault',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Legion',
      code: 'legion',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'Haven',
      code: 'haven',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete({ schema: 'admin', tableName: 'departments' }, null, {});
}
