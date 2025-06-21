import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js'; // Use the main DB connection


const GetUpdates = sequelize1.define('GetUpdates', {
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
    teach:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    learn:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    endeavour:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

}, {
  schema: 'user', // Private schema
  tableName: 'getUpdates', // Table name
  timestamps: true,
});

export { GetUpdates };
