'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'user_devices', schema: 'user' },
      'is_in_session',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      { tableName: 'user_devices', schema: 'user' },
      'is_in_session'
    );
  }
};
