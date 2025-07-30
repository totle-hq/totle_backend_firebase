'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.addColumn(
      { tableName: 'users', schema: 'user' },
      'ip_address',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.removeColumn(
      { tableName: 'users', schema: 'user' },
      'ip_address'
    );
  }
};
