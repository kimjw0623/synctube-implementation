const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const video = require('./video.model.js');


const room = sequelize.define("room", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING
    },
    player_current_time: {
        type: DataTypes.INTEGER
    },
    player_current_state: {
        type: DataTypes.INTEGER
    },
    video_id: {
        type: DataTypes.STRING,
        references: {
          model: video, // 참조하는 모델
          key: 'id'   // 참조하는 모델의 열
        }
    }
});

room.belongsTo(video, { foreignKey: 'owner_id' });
video.hasOne(room, { foreignKey: 'owner_id' });