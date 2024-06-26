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
    const initVideo = "Po4AAWH8BAU";
    const initPlaylist = ["CRMOwaIkYSY"];
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

function authAndJoinRoom(socket) {
    const token = socket.handshake.query.token
    if (token) {
        const roomName = tokenRoomDict[token]
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err);
                socket.emit("removeToken");
                return;
            }
            if (roomName) {
                socket.jwt = token;
                socket.nickname = tokenNicknameDict[token];
                socket.emit("enterRoomWithToken", roomName, tokenNicknameDict[token], roomMessage[roomName]);
            }
            else {
                console.log("unknown token!");
                socket.emit("removeToken");
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
        wsServer.to(roomName).emit("updateUserList", roomUser[roomName], newNickname);
    });
    socket.on("enterRoom", async (data, socketId, done) => {
        const roomName = data.roomName;
        const chatColor = data.userColor;
        socket.roomName = roomName;
        // Join room and emit 
        socket.join(roomName);
        done();
        if (!(roomName in roomMessage)) {
            console.log("First Message!", roomName);
            roomMessage[roomName] = [];
        }
        console.log(socket.nickname);

        if (!(roomName in roomUser)) { // First client in the room
            console.log("First user!", roomName);
            roomUser[roomName] = [{
                nickname: socket.nickname,
                color: chatColor
            }];
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
            roomUser[roomName].push({
                nickname: socket.nickname,
                color: chatColor
            });
            roomUser[roomName].sort();
        }
        console.log(roomUser[roomName]);
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
        if (roomName) {
            const result = removeUserFromList(roomUser[roomName], socket.nickname);
            roomUser[roomName] = result.userList;
            wsServer.to(roomName).emit("updateUserList", result.userList);
        }
    });
    socket.on("disconnect", () => {
        console.log("exit!");
        const roomName = socket.roomName;
        wsServer.sockets.emit("roomChange", publicRooms());
        if (roomName) {
            const result = removeUserFromList(roomUser[roomName], socket.nickname);
            roomUser[roomName] = result.userList;
            wsServer.to(roomName).emit("updateUserList", result.userList);
        }
        
    });
    socket.on("leaveRoom", (roomName) => {
        socket.leave(roomName, () => {
            console.log(`${socket.id} has left the room ${roomName}`);
        });
        wsServer.sockets.emit("roomChange", publicRooms());
        const result = removeUserFromList(roomUser[roomName], socket.nickname);
        roomUser[roomName] = result.userList;
        wsServer.to(roomName).emit("updateUserList", result.userList);
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
        if (serverState !== undefined) {
            serverState.playerTime = data.playerTime;
            if (isVideoEnd(serverState.currentVideo.duration, serverState.playerTime) ||
                (data.playerState === 0 && serverState.playlist.length != 0)) { // video ends
                serverState.playerState = data.playerState;
                serverState.currentVideo = serverState.playlist.shift();
                const videoInfo = await utils.readVideoDB(serverState.currentVideo.id);
                wsServer.to(data.room).emit("videoUrlChange", serverState, videoInfo.comment);
                wsServer.to(data.room).emit("updatePlaylist", serverState.playlist);
            }
            else if (data.playerState !== -1) {
                wsServer.to(data.room).emit("stateChange", data); // Include emitter
                serverState.playerState = data.playerState;
                serverState.playerTime = data.playerTime;
                console.log("Playertime:", serverState.playerTime, serverState.playerState, socket.nickname);
            }
        }
    });
    socket.on("syncTime", (room, playerTime) => {
        // update serverTime
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (serverState !== undefined) {
            serverState.playerTime = playerTime;
            const data = {
                playerTime: playerTime,
                playerState: serverState.playerState
            };
        }
        // This causes loop
        // wsServer.to(room).emit("SyncTime", data);
    });
    socket.on("videoUrlChange", async (data) => {
        const roomName = socket.roomName
        const serverState = roomPlayerState[roomName];
        if (data.videoId != "") {
            serverState.currentVideo = await getMetadataFromVideoId(data);
            if (serverState.currentVideo !== undefined) {
                serverState.playerTime = 0;
                // send to all members in room
                const videoInfo = await utils.readVideoDB(serverState.currentVideo.id);
                wsServer.to(data.room).emit("videoUrlChange", serverState, videoInfo.comment);
            }
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
        console.log(idList);
        serverState.playlist = idList;
        wsServer.to(room).emit("updatePlaylist", idList);
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
