const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const video = sequelize.define("video", {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING
    },
    thumbnail_url: {
        type: DataTypes.STRING
    },
    channel_title: {
        type: DataTypes.STRING
    },
    duration: {
        type: DataTypes.INTEGER
    }
});

module.exports = video;