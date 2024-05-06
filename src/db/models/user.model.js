const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const user = sequelize.define("user", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    token: {
        type: DataTypes.STRING
    },
    nickname: {
        type: DataTypes.STRING
    },
    color: {
        type: DataTypes.STRING
    },
    auth: {
        type: DataTypes.STRING
    }
});

module.exports = user;