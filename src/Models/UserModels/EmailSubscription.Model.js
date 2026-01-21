// models/emailSubscription.model.js

import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';


const EmailSubscription = sequelize1.define("EmailSubscription", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    subscribedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    subscriptionStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "subscribed",
        validate: {
        isIn: [["subscribed", "unsubscribed"]],
        },
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: "users", // must match User table name in lowercase
            key: "id",
        },
        onDelete: "SET NULL",
    },

}, {
  schema: 'user', // Private schema
  tableName: 'emailSubscription', // Table name
  timestamps: true,
});

export { EmailSubscription };

