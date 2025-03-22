import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection


const BetaUsers = sequelize1.define('BetaUsers', {
    id:{
        type: DataTypes.UUID, // ✅ Use UUID as primary key
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    email:{
        type: DataTypes.STRING,
        unique: true,
    },
    firstName:{
        type: DataTypes.STRING,
        allowNull: false,
    },

}, {
  schema: 'user', // Private schema
  tableName: 'betaUsers', // Table name
  timestamps: true,
});

export { BetaUsers };
