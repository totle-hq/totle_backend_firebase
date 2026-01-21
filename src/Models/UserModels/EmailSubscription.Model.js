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
});

export { EmailSubscription };

