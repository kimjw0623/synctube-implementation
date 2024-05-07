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


const videoTable = createVideoModel(sequelize, DataTypes);
const userTable = createUserModel(sequelize, DataTypes);
const roomTable = createRoomModel(sequelize, DataTypes);

roomTable.belongsTo(videoTable, { foreignKey: 'video_id' });
// videoTable.hasOne(roomTable, { foreignKey: 'id' });

db.videoTable = videoTable;
db.userTable = userTable;
db.roomTable = roomTable;

export default db;