import dbConfig from '../config/db.config.js';
import { DataTypes, Sequelize } from 'sequelize';

export const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
	host: dbConfig.HOST,
	dialect: dbConfig.dialect,
	operatorsAliases: false,
	pool: {
		max: dbConfig.pool.max,	
		min: dbConfig.pool.min,
		acquire: dbConfig.pool.acquire,
		idle: dbConfig.pool.idle
    }
});

export const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

import createVideoModel from './video.model.js';
import createUserModel from './user.model.js';
import createRoomModel from './room.model.js';
import createMessageModel from './message.model.js';
import createCommentModel from './comment.model.js';
import createPlaylistModel from './playlist.model.js';
import createParticipantModel from './participant.model.js';

const videoTable = createVideoModel(sequelize, DataTypes);
const userTable = createUserModel(sequelize, DataTypes);
const roomTable = createRoomModel(sequelize, DataTypes);
const messageTable = createMessageModel(sequelize, DataTypes);
const commentTable = createCommentModel(sequelize, DataTypes);
const playlistTable = createPlaylistModel(sequelize, DataTypes);
const participantTable = createParticipantModel(sequelize, DataTypes);

roomTable.belongsTo(videoTable, {
    foreignKey: 'video_id',
    onDelete: 'CASCADE',  // Video가 삭제되면 video_id도 삭제
    onUpdate: 'CASCADE'   // Video id가 변경되면 video_id도 업데이트
});
messageTable.belongsTo(userTable, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
messageTable.belongsTo(roomTable, {
    foreignKey: 'room_id',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
});
commentTable.belongsTo(videoTable, {
    foreignKey: 'video_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
playlistTable.belongsTo(userTable, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
playlistTable.belongsTo(roomTable, {
    foreignKey: 'room_id',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
});
playlistTable.belongsTo(videoTable, {
    foreignKey: 'video_id',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
});
participantTable.belongsTo(userTable, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
participantTable.belongsTo(roomTable, {
    foreignKey: 'room_id',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE' 
});

db.videoTable = videoTable;
db.userTable = userTable;
db.roomTable = roomTable;
db.messageTable = messageTable;
db.commentTable = commentTable;
db.playlistTable = playlistTable;

export default db;