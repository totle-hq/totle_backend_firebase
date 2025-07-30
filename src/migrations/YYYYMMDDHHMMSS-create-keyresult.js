// migrations/YYYYMMDDHHMMSS-create-keyresult.js

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('key_results', {
    keyResultId: {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: Sequelize.literal('uuid_generate_v4()'),
    },
    objectiveId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'objectives',
        key: 'objectiveId',
      },
      onDelete: 'CASCADE',
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    progress: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    order: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.fn('now'),
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.fn('now'),
    },
    deletedAt: {
      allowNull: true,
      type: Sequelize.DATE,
    },
  });

  await queryInterface.addIndex('key_results', ['objectiveId']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('key_results');
}
