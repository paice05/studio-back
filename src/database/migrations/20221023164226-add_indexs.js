'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS schedules_userid_serviceid_employeeid_index ON schedules ("userId","serviceId","employeeId")'
    );
  },
  down: async (queryInterface) => {
    return queryInterface.sequelize.query(
      'DROP INDEX schedules_userid_serviceid_employeeid_index'
    );
  },
};
