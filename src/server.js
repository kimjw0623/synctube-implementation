import path from "path";
import http from "http";
import {Server} from "socket.io";
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { generateUsername } from "unique-username-generator";
import * as utils from "./util/utils.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true,
    },
});

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

function removeUserFromList(roomUserList, nickname) {
    // remove user from userList
    if (roomUserList) {
        const idx = roomUserList.indexOf(nickname);
        if (idx > -1) roomUserList.splice(idx, 1);
    }
    return roomUserList
}

function getYoutubeVideoId(url) {
    var searchParams = new URLSearchParams(new URL(url).search);
    return searchParams.get("v");
}

function parseVideoMetadata(response) {
    const id = response.items[0].id;
    const title = response.items[0].snippet.title;
    const thumbnailUrl = response.items[0].snippet.thumbnails.default.url;
    const channelTitle = response.items[0].snippet.channelTitle;
    const duration = response.items[0].contentDetails.duration;
    const result = {
        id: id,
        title: title,
        thumbnailUrl: thumbnailUrl,
        channelTitle: channelTitle,
        duration: utils.parseISODuration(duration, false)
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
    await utils.insertVideoDB(videoId);
    const videoInfo = await utils.readVideoDB(videoId);
    return parseVideoMetadata(videoInfo.metadata);
}

function authAndJoinRoom(socket) {
    const token = socket.handshake.query.token
    if (token) {
        const roomName = tokenRoomDict[token]
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err);
                return;
            }
            if (roomName) {
                socket.nickname = tokenNicknameDict[token];
                socket.emit("enterRoomWithToken", roomName, tokenNicknameDict[token], roomMessage[roomName]);
            }
            else {
                console.log("unknown token!");
                // throw new Error("Unknown token!");
            }
        });
    }
}

function connectionSocketListeners(socket) {
    socket.onAny((event) => {
        console.log(`socket Event: ${event}`);
    });
    socket.on("requestToken", (roomName) => {
        // Give token and nickname when enter room
        const nickname = generateUsername("", 0, 15);
        socket.nickname = nickname;
        const token = jwt.sign({ nickname: nickname}, secretKey, { expiresIn: '1d' });
        socket.jwt = token;
        tokenNicknameDict[token] = nickname;
        tokenRoomDict[token] = roomName;
        wsServer.to(socket.id).emit('issueToken', token, nickname);
    });
    socket.on("changeUserId", (newNickname, oldNickname) => {
        const roomName = socket.roomName;
        roomUser[roomName] = removeUserFromList(roomUser[roomName], oldNickname)
        roomUser[roomName].push(newNickname);
        socket.nickname = newNickname;
        // Update token-nickname dict
        tokenNicknameDict[socket.jwt] = newNickname;
        wsServer.to(roomName).emit("bye", roomUser[roomName], newNickname);
    });
    socket.on("enterRoom", async (roomName, socketId, done) => {
        socket.roomName = roomName;
        // Join room and emit 
        socket.join(roomName);
        done();
        if (!(roomName in roomMessage)) {
            console.log("First Message!", roomName);
            roomMessage[roomName] = [];
        }
        if (!(roomName in roomUser)) { // First client in the room
            console.log("First user!", roomName);
            roomUser[roomName] = [socket.nickname];
            const serverState = {
                currentVideo: {},
                playerState: -1,
                playerTime: 0,
                playerVolume: 20,
                playlist: []
            };
            roomPlayerState[roomName] = serverState;
            roomPlayerState[roomName] = await initializeServer(roomPlayerState[roomName]);
        }
        else {
            roomUser[roomName].push(socket.nickname);
        }

        wsServer.to(roomName).emit("welcome", roomUser[roomName], socket.nickname, roomMessage[roomName]);
        wsServer.sockets.emit("roomChange", publicRooms());
        const serverState = roomPlayerState[roomName];
        const videoInfo = await utils.readVideoDB(serverState.currentVideo.id);
        wsServer.to(socketId).emit("initState", serverState, videoInfo.comment);
        wsServer.to(socketId).emit("updatePlaylist", serverState.playlist);
    });
    socket.on("disconnecting", () => {
        const roomName = socket.roomName;
        wsServer.sockets.emit("roomChange", publicRooms());
        roomUser[roomName] = removeUserFromList(roomUser[roomName], socket.nickname)
        socket.to(roomName).emit("bye", roomUser[roomName], socket.nickname);
    });
    socket.on("disconnect", () => {
        console.log("exit!")
    });
    socket.on("leaveRoom", (roomName) => {
        socket.leave(roomName, () => {
            console.log(`${socket.id} has left the room ${roomName}`);
        });
        wsServer.sockets.emit("roomChange", publicRooms());
        roomUser[roomName] = removeUserFromList(roomUser[roomName], socket.nickname)
        socket.to(roomName).emit("bye", roomUser[roomName], socket.nickname);
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
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        serverState.playerTime = data.currentTime;
        if (isVideoEnd(serverState.currentVideo.duration,serverState.playerTime) ||
            (data.playerState === 0 && serverState.playlist.length != 0)) { // video ends
            serverState.playerState = data.playerState;
            serverState.currentVideo = serverState.playlist.shift();
            const videoInfo = await utils.readVideoDB(serverState.currentVideo.id);
            wsServer.to(data.room).emit("videoUrlChange", serverState, videoInfo.comment);
            wsServer.to(data.room).emit("updatePlaylist", serverState.playlist);
        }
        else {// if (serverState.playerState !== data.playerState){
            wsServer.to(data.room).emit("stateChange", data); // Include emitter
            serverState.playerState = data.playerState;
        }
    });
    socket.on("syncTime", (room, currentTime) => {
        // update serverTime
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        serverState.playerTime = currentTime;
        const data = {
            currentTime: currentTime,
            playerState: serverState.playerState
        };
        wsServer.to(room).emit("SyncTime", data);
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
    socket.on("addPlaylist", async (data) => {
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (data.videoId != "") {
            serverState.playlist.push(await getMetadataFromVideoId(data));
            wsServer.to(data.room).emit("updatePlaylist", serverState.playlist)
        }
    });
    socket.on("changePlaylist", async (data, room) => {
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (data.length !== 0) {
            serverState.playlist = [];
            const promises = data.map(videoId => utils.readVideoDB(videoId));
            const videosInfo = await Promise.all(promises);
            videosInfo.forEach(videoInfo => {
                serverState.playlist.push(parseVideoMetadata(videoInfo.metadata));
            });
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
