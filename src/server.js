import path from "path";
import http from "http";
import {Server} from "socket.io";
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { generateUsername } from "unique-username-generator";
import * as utils from "./util/utils.js";

const app = express();
app.set("view engine", "pug");
app.set("views", "./src/views");
app.use("/public", express.static("./src/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/test/", (_, res) => res.render("test", {
    playlist: ["qwer","asdf"], // Make sure this is an array
    chatMessages: ["qwer","asdf"] // Make sure this is an array
}));

dotenv.config();

const secretKey = 'secretKey';
const currentServerState = {
    currentVideo: {},
    playerState: -1,
    playerTime: 0,
    playerVolume: 20,
    playlist: []
}
const roomList = [];
const tokenNicknameDict = {}; // TODO: move to DB!
const tokenRoomDict = {}; // TODO: move to DB!
const defaultRoom = "abc";
const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true,
    },
});


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

function getYoutubeVideoId(url) {
    var searchParams = new URLSearchParams(new URL(url).search);
    return searchParams.get("v");
}

function processResponse(response) {
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

async function initializeDev() {
    const initVideo = "1EJcaxYMZzQ";
    const initPlaylist = ["CRMOwaIkYSY","Po4AAWH8BAU","M7lc1UVf-VE"];
    await utils.insertVideoDB(initVideo);
    let videoInfo = await utils.readVideoDB(initVideo);
    currentServerState.currentVideo = processResponse(videoInfo.metadata);
    
    if (initPlaylist.length != 0) {
        initPlaylist.forEach(async videoId => {
            await utils.insertVideoDB(videoId);
            videoInfo = await utils.readVideoDB(videoId);
            currentServerState.playlist.push(processResponse(videoInfo.metadata));
        });
    }
    
}

async function getMetadataFromId(data) {
    const videoId = getYoutubeVideoId(data.videoId)
    await insertVideoDB(videoId);
    const videoInfo = await utils.readVideoDB(videoId);
    return processResponse(videoInfo.metadata);
}

wsServer.on("connection", (socket) => { // socket connection
    if (socket.handshake.query.token) {
        jwt.verify(socket.handshake.query.token, secretKey, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err);
                return;
            }
            console.log('Decoded payload:', decoded);
            if (tokenRoomDict[socket.handshake.query.token]) {
                socket.emit("enterRoomwToken", tokenRoomDict[socket.handshake.query.token]);
            }
            else {
                console.log("default room...")
                socket.emit("enterRoomwToken", defaultRoom);
            }
            // Enter room corresponding to the token
        })
    }
    else { 
        // Give token and nickname when enter room
        const nickname = generateUsername("", 0, 15);
        socket["nickname"] = nickname;
        const token = jwt.sign({ nickname: nickname}, secretKey, { expiresIn: '1d' });
        socket["jwt"] = token;
        tokenNicknameDict[token] = nickname;
        wsServer.to(socket.id).emit('token', token);
    }
    wsServer.sockets.emit("room_change", publicRooms());
    socket.onAny((event) => {
        console.log(`socket Event: ${event}`);
    });
    socket.on("enterRoom", (msg, done) => {
        console.log("enterRoom: ", msg, done);
        const roomName = msg.roomName
        socket.join(roomName);
        if (typeof done === "function") {
            done();
        }
        else {
            console.log("done is not a function!!!!!!!!!!")
        }
        wsServer.to(roomName).emit("welcome", countRoom(roomName), socket.nickname);
        wsServer.sockets.emit("room_change", publicRooms());
        console.log(`roomname: ${roomName}`);
        console.log(msg.token);
        tokenRoomDict[msg.token] = roomName;
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => socket.to(room).emit("bye", countRoom(room)-1, socket.nickname));
    })
    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());
        console.log("exit!")
    });
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message",`${socket.nickname}: ${msg}`, countRoom(room))
        console.log(msg)
        done();
    })
    socket.on("nickname", nickname => socket["nickname"] = nickname);
    // -----------------------------------------

    // init player
    socket.on("initState", async (socketId) => {
        const videoInfo = await utils.readVideoDB(currentServerState.currentVideo.id);
        wsServer.to(socketId).emit("initState", currentServerState, videoInfo.comment);
        wsServer.to(socketId).emit("updatePlaylist", currentServerState.playlist);
    });
    socket.on("stateChange", async (data) => {
        currentServerState.playerState = data.playerState;
        currentServerState.playerTime = data.currentTime;
        if (isVideoEnd(currentServerState.currentVideo.duration,currentServerState.playerTime) ||
            (data.playerState === 0 && currentServerState.playlist.length != 0)) { // video ends
            currentServerState.currentVideo = currentServerState.playlist.shift();
            const videoInfo = await utils.readVideoDB(currentServerState.currentVideo.id);
            wsServer.to(data.room).emit("videoUrlChange", currentServerState, videoInfo.comment);
            wsServer.to(data.room).emit("updatePlaylist", currentServerState.playlist);
        }
        else {wsServer.to(data.room).emit("stateChange", data);}
    });
    socket.on("syncTime", (room, currentTime) => {
        // update serverTime
        currentServerState.playerTime = currentTime;
        const data = {
            currentTime: currentTime,
            playerState: currentServerState.playerState
        };
        wsServer.to(room).emit("SyncTime", data);
        console.log(`time: ${currentTime}`)
    });
    socket.on("videoUrlChange", async (data) => {
        if (data.videoId != "") {
            currentServerState.currentVideo = await getMetadataFromId(data);
            currentServerState.playerTime = 0;
            // send to all members in room
            wsServer.to(data.room).emit("videoUrlChange", currentServerState, videoInfo.comment);
        }
    });
    socket.on("addPlaylist", async (data) => {
        if (data.videoId != "") {
            currentServerState.playlist.push(await getMetadataFromId(data));
            wsServer.to(data.room).emit("updatePlaylist", currentServerState.playlist)
        }
    })
    socket.on("changePlaylist", async (data, room) => {
        if (data.length !== 0) {
            currentServerState.playlist = [];
            const promises = data.map(videoId => readVideoDB(videoId));
            const videosInfo = await Promise.all(promises);
            videosInfo.forEach(videoInfo => {
                currentServerState.playlist.push(processResponse(videoInfo.metadata));
            });
            wsServer.to(room).emit("updatePlaylist", currentServerState.playlist);
        }
    })
});

await initializeDev(); // should remove at production
httpServer.listen(3000, handleListen);