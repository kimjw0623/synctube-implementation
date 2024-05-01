import path from "path";
import http from "http";
import {Server} from "socket.io";
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { generateUsername } from "unique-username-generator";
import * as utils from "./util/utils.js";
import Database from "better-sqlite3";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true,
    },
});

// TODO: move filename to .env
const db = new Database("./sqlite/db1.db", { verbose: console.log });
db.pragma("journal_mode = WAL");
// Application Settings
app.set("view engine", "pug");
app.set("views", "./src/views");
app.use("/public", express.static("./src/public"));

// Routes
app.get("/", (_, res) => res.render("home"));
app.get("/test/", (_, res) => res.render("test", {
    playlist: ["qwer","asdf"],
    chatMessages: ["qwer","asdf"]
}));

// In-memory data storage (should be replaced with DB for production)
const tokenNicknameDict = {};
const tokenRoomDict = {};
const roomMessage = {}; // TODO: move to DB
// {roomName:[{nickname:nickname,content:content}]}
const roomUser = {};
// {roomName:[nickname]}
const roomPlayerState = {};
// {roomName:{serverState}}

const defaultRoom = "abc";
const secretKey = process.env.SECRET_KEY || 'secretKey';

async function initializeServer(serverState) {
    const initVideo = "1EJcaxYMZzQ";
    const initPlaylist = ["CRMOwaIkYSY","Po4AAWH8BAU","M7lc1UVf-VE"];
    await utils.insertVideoDB(initVideo);
    let videoInfo = await utils.readVideoDB(initVideo);
    serverState.currentVideo = parseVideoMetadata(videoInfo.metadata);
    
    if (initPlaylist.length != 0) {
        for (const videoId of initPlaylist) {
            await utils.insertVideoDB(videoId);
            const videoInfo = await utils.readVideoDB(videoId);
            serverState.playlist.push(parseVideoMetadata(videoInfo.metadata));
        }
    }
    return serverState
}

function publicRooms(){
    const sids = wsServer.sockets.adapter.sids;
    const rooms = wsServer.sockets.adapter.rooms;
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countRoom(roomName){
    return wsServer.sockets.adapter.rooms.get(roomName).size;
}

function removeUserFromList(roomUserList, targetNickname) {
    let userList = [];
    let targetColor = "#fff";
    roomUserList.forEach(item => {
        if (item.nickname !== targetNickname) {
            userList.push(item);
        }
        else {
            targetColor = item.color;
        }
    });
    const data = {
        userList: userList,
        targetColor: targetColor
    };
    return data
}

function getYoutubeVideoId(url) {
    let searchParams
    const pattern = /^[a-zA-Z0-9_-]{11}$/;
    if (pattern.test(url)) {
        return url
    }
    try {
        searchParams = new URLSearchParams(new URL(url).search);
    }
    catch (error) {
        console.error("An error occurred: ", error.message);
        return null
    }
    return searchParams.get("v");
}

function parseVideoMetadata(response, data=null) {
    const id = response.items[0].id;
    const title = response.items[0].snippet.title;
    const thumbnailUrl = response.items[0].snippet.thumbnails.default.url;
    const channelTitle = response.items[0].snippet.channelTitle;
    const duration = response.items[0].contentDetails.duration;
    let applicant = "default";
    let applicantColor = "#fff";
    if (data) {
        applicant = data["applicant"];
        applicantColor = data["applicantColor"];
    }
    const result = {
        id: id,
        title: title,
        thumbnailUrl: thumbnailUrl,
        channelTitle: channelTitle,
        duration: utils.parseISODuration(duration, false),
        applicant: applicant,
        applicantColor: applicantColor,
    }
    return result;
}

function isVideoEnd(duration, currentTime) {
    const durationSeconds = utils.timeStringToSeconds(duration);
    if (Math.abs(durationSeconds - currentTime < 2)) {
        return true
    }
    else {
        return false
    }
}

async function getMetadataFromVideoId(data) {
    const videoId = getYoutubeVideoId(data.videoId)
    if (videoId) {
        await utils.insertVideoDB(videoId);
        const videoInfo = await utils.readVideoDB(videoId);
        return parseVideoMetadata(videoInfo.metadata, data);
    }
}

// MARK: authAndJoinRoom
function authAndJoinRoom(socket) {
    const token = socket.handshake.query.token
    if (token) {
        // Check token is in the User:user_token
        const rowUser = selectRowFromDB("User", "user_token", token);
        if (rowUser === undefined) {
            socket.emit("removeToken");
            return
        }
        let query = db.prepare(`SELECT room_id FROM Room_User WHERE user_id='${rowUser["user_id"]}'`);
        const rowRoomUser = query.all()[0];
        if (rowRoomUser === undefined) {
            socket.emit("removeToken");
            return
        }
        const roomName = rowRoomUser.room_id;

        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err);
                socket.emit("removeToken");
                return
            }
            else if (roomName) {
                socket.jwt = token;
                socket.nickname = rowUser["user_id"];
                // query = `SELECT user_nickname FROM User WHERE user_token='${token}'`
                // const nickname = query.all()[0]
                socket.emit("enterRoomWithToken", roomName, rowUser["user_nickname"]);
            }
            else {
                console.log("unknown token!");
                socket.emit("removeToken");
                return
            }
        });
    }
}

function getRandomColorHex() {
    const randomColor = () => Math.floor(Math.random() * 256).toString(16);
    const color = `#${randomColor()}${randomColor()}${randomColor()}`;
    return color.length < 7 ? color + "0" : color;
}

// Do SELECT from DB table
function selectRowFromDB(table, column, value) {
    const selectOne = db.prepare(`SELECT * FROM ${table} WHERE ${column} = ?`);
    const result = selectOne.get(value);
    return result
}

function connectionSocketListeners(socket) {
    socket.onAny((event) => {
        console.log(`socket Event: ${event}`);
    });
    // MARK: requestToken
    socket.on("requestToken", (roomName) => {
        // Give token and nickname when client newly enter room
        const userId = generateUsername("", 0, 15);
        const userToken = jwt.sign({ userId: userId }, secretKey, { expiresIn: '1d' });
        const userColor = getRandomColorHex();
        // In memory
        socket.nickname = userId;
        socket.jwt = userToken;
        // tokenNicknameDict[token] = nickname;
        // tokenRoomDict[token] = roomName;
        // In database
        const insertUser = db.prepare(`INSERT INTO User (user_id, user_nickname, user_token, user_color) VALUES (?, ?, ?, ?)`);
        insertUser.run(userId, userId, userToken, userColor);
        
        wsServer.to(socket.id).emit('issueToken', userToken, userId);
    });
    socket.on("changeUserId", (newNickname, oldNickname) => {
        const roomName = socket.roomName;
        console.log(newNickname, oldNickname);
        const result = removeUserFromList(roomUser[roomName], oldNickname);
        roomUser[roomName] = result.userList;
        const targetColor = result.targetColor;
        roomUser[roomName].push({nickname: newNickname, color: targetColor});
        roomUser[roomName].sort();
        console.log(roomUser[roomName]);
        socket.nickname = newNickname;
        // Update token-nickname dict
        tokenNicknameDict[socket.jwt] = newNickname;
        wsServer.to(roomName).emit("updateUserList", roomUser[roomName]);
    });
    // When the user enters the room
    // MARK: enterRoom
    socket.on("enterRoom", async (data, socketId, done) => {
        // Change: roomName to roomId
        const roomName = parseInt(data.roomName);
        const chatColor = data.userColor;
        socket.roomName = roomName;
        // Join room and emit 
        socket.join(roomName);
        done();
        // Check if the User exists in User table
        const rowUser = selectRowFromDB("User", "user_id", socket.nickname);
        if (rowUser === undefined) {
            console.log("Invalid User!")
            return
        }

        // Check if the room exists in Room table
        let rowRoom = selectRowFromDB("Room", "room_id", roomName);
        // If room doesn't exist, initialize
        if (rowRoom === undefined) {
            const insertRoom = db.prepare(`INSERT INTO Room (room_id, player_current_time, player_current_state) VALUES (?, ?, ?)`);
            insertRoom.run(roomName, 0, 0);
        }

        // Check if the Room_User row exists
        const queryRoomUser = db.prepare(`SELECT * FROM Room_User WHERE user_id='${rowUser["user_id"]}' AND room_id='${roomName}'`);
        const rowRoomUser = queryRoomUser.all(); // queryRoomUser.get(value);
        if (rowRoomUser.length === 0) {
            const insertRoom_User = db.prepare(`INSERT INTO Room_User (user_id, room_id) VALUES (?, ?)`);
            insertRoom_User.run(rowUser["user_id"], roomName)
        }
        
        // Get all user_ids in the room
        let query = db.prepare(`SELECT user_id FROM Room_User WHERE room_id='${roomName}' ORDER BY user_id`);
        const users = query.all(); // [{user_id: 'user1234'}, ...]
        // Get all messages in the room
        query = db.prepare(`SELECT * FROM Chat WHERE room_id='${roomName}' ORDER BY timestamp`);
        const chattings = query.all();
        // Get all rooms in the room
        query = db.prepare(`SELECT room_id,room_title FROM Room ORDER BY room_id`);
        const roomList = query.all();
        // Get room info
        rowRoom = selectRowFromDB("Room", "room_id", roomName);
        // Get comment of current video of the room
        if (rowRoom["video_id"] === undefined) {
            query = db.prepare(`SELECT * FROM Comment WHERE video_id='${rowRoom["video_id"]}'`);
            const currentComments = query.all();
        }
        // Get playlist
        query = db.prepare(`SELECT * FROM Playlist WHERE room_id=${roomName} ORDER BY video_order`);
        const currentPlaylist = query.all();
        
        // update room list for all rooms
        wsServer.sockets.emit("roomChange", publicRooms());
    
        // MARK: TODO!!

        // initialize room for the socket id
        const serverState = roomPlayerState[roomName];
        const videoInfo = await utils.readVideoDB(serverState.currentVideo.id); // TODO!
        wsServer.to(socketId).emit("initState", serverState, videoInfo.comment);
        // update playlist with event ()
        wsServer.to(socketId).emit("updatePlaylist", serverState.playlist);
        // update user list for the room
        wsServer.to(roomName).emit("updateUserList", roomUser[roomName]);
    });
    socket.on("disconnecting", () => {
        const roomName = socket.roomName;
        wsServer.sockets.emit("roomChange", publicRooms());
        if (roomName) {
            const result = removeUserFromList(roomUser[roomName], socket.nickname);
            roomUser[roomName] = result.userList;
        }
    });
    socket.on("disconnect", () => {
        console.log("exit!")
    });
    socket.on("leaveRoom", (roomName) => {
        socket.leave(roomName, () => {
            console.log(`${socket.id} has left the room ${roomName}`);
        });
        wsServer.sockets.emit("roomChange", publicRooms());
        const result = removeUserFromList(roomUser[roomName], socket.nickname);
        roomUser[roomName] = result.userList;
    });
    socket.on("newMessage", (msg, room, chatColor, done) => {
        const nickname = socket.nickname
        const messageData = {
            "nickname": nickname,
            "content": msg,
            "color": chatColor
        }
        roomMessage[room].push(messageData);
        console.log(room, roomMessage);
        socket.to(room).emit("newMessage", messageData, countRoom(room))
        done();
    });
    //socket.on("nickname", nickname => socket["nickname"] = nickname);
}

function playerSocketListeners(socket) {
    socket.on("stateChange", async (data) => {
        const roomName = socket.roomName;
        const serverState = roomPlayerState[roomName];
        serverState.playerTime = data.playerTime;
        if (isVideoEnd(serverState.currentVideo.duration,serverState.playerTime) ||
            (data.playerState === 0 && serverState.playlist.length != 0)) { // video ends
            serverState.playerState = data.playerState;
            serverState.currentVideo = serverState.playlist.shift();
            const videoInfo = await utils.readVideoDB(serverState.currentVideo.id);
            wsServer.to(data.room).emit("videoUrlChange", serverState, videoInfo.comment);
            wsServer.to(data.room).emit("updatePlaylist", serverState.playlist);
        }
        else if (data.playerState !== -1){
            wsServer.to(data.room).emit("stateChange", data); // Include emitter
            serverState.playerState = data.playerState;
            serverState.playerTime = data.playerTime;
            console.log("Playertime:",serverState.playerTime, serverState.playerState, socket.nickname);
        }
    });
    socket.on("syncTime", (room, playerTime) => {
        // update serverTime
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        serverState.playerTime = playerTime;
        const data = {
            playerTime: playerTime,
            playerState: serverState.playerState
        };
        // wsServer.to(room).emit("SyncTime", data);
    });
    socket.on("videoUrlChange", async (data) => {
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (data.videoId != "") {
            serverState.currentVideo = await getMetadataFromVideoId(data);
            serverState.playerTime = 0;
            // send to all members in room
            const videoInfo = await utils.readVideoDB(serverState.currentVideo.id);
            wsServer.to(data.room).emit("videoUrlChange", serverState, videoInfo.comment);
        }
    });
    socket.on("addVideo", async (data) => {
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (data.videoId != "") {
            const videoMetadata = await getMetadataFromVideoId(data);
            serverState.playlist.push(videoMetadata);
            wsServer.to(data.room).emit("updatePlaylist", serverState.playlist)
        }
    });
    socket.on("changePlaylist", async (idList, room) => {
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (idList.length !== 0) {
            serverState.playlist = idList;
            wsServer.to(room).emit("updatePlaylist", serverState.playlist);
            console.log(serverState.playlist);
        }
    });
}

wsServer.on("connection", (socket) => { // socket connection
    wsServer.sockets.emit("roomChange", publicRooms());
    authAndJoinRoom(socket);
    connectionSocketListeners(socket);
    playerSocketListeners(socket);
});

// Start the server
const port = process.env.PORT || 3000;
const ipAddr = process.env.IP_ADDR || "0.0.0.0";
httpServer.listen(port, ipAddr, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
