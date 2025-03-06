import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();
// Sequelize instance for the first database
const sequelize1 = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Turn off logging for production
});

// Sequelize instance for the second database (if applicable)
// const sequelize2 = new Sequelize(process.env.DATABASE_URL2, {
//   dialect: 'postgres',
//   logging: false,
// });

// Export both Sequelize instances
export { sequelize1 };
