// migrations/YYYYMMDDHHMMSS-add-fields-to-keyresult.js

export async function up(queryInterface, Sequelize) {
  await queryInterface.sequelize.transaction(async (t) => {
    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'targetMetric',
      { type: Sequelize.STRING, allowNull: true, comment: 'Short label, e.g., Learner Activation 7d' },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'targetOperator',
      { type: Sequelize.ENUM('gte', 'lte', 'eq', 'gt', 'lt'), allowNull: true },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'targetValue',
      { type: Sequelize.FLOAT, allowNull: true },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'unit',
      { type: Sequelize.STRING(20), allowNull: true },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'currentValue',
      { type: Sequelize.FLOAT, allowNull: true },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'measureSource',
      { type: Sequelize.STRING, allowNull: true },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'status',
      {
        type: Sequelize.ENUM('on_track', 'at_risk', 'off_track', 'paused', 'done'),
        defaultValue: 'on_track',
      },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'ownerDepartmentId',
      { type: Sequelize.UUID, allowNull: true, comment: 'FK → Departments table' },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'ownerUserId',
      { type: Sequelize.UUID, allowNull: true, comment: 'FK → Users table' },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'startDate',
      { type: Sequelize.DATEONLY, allowNull: true },
      { transaction: t }
    );

    await queryInterface.addColumn(
      { tableName: 'key_results', schema: 'admin' },
      'dueDate',
      { type: Sequelize.DATEONLY, allowNull: true },
      { transaction: t }
    );
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.transaction(async (t) => {
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'targetMetric', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'targetOperator', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'targetValue', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'unit', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'currentValue', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'measureSource', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'status', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'ownerDepartmentId', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'ownerUserId', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'startDate', { transaction: t });
    await queryInterface.removeColumn({ tableName: 'key_results', schema: 'admin' }, 'dueDate', { transaction: t });

    // Drop ENUM types explicitly (Postgres requirement)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_key_results_targetOperator";', { transaction: t });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_key_results_status";', { transaction: t });
  });
}
