import path from "path";
import http from "http";
import {Server} from "socket.io";
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { generateFromEmail, generateUsername } from "unique-username-generator";
const app = express();

dotenv.config();

const secretKey = 'secretKey';

mongoose.connect('mongodb://localhost:27017/videos', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connect.'))
.catch(err => console.error('MongoDB failed.', err));

const Schema = mongoose.Schema;

const userSchema = new Schema({
    videoId: { type: String, required: true, unique: true },
    comment: { type: "Mixed", default: {} },
    metadata: { type: "Mixed", default: {} },
});
const videoDB = mongoose.model('Video', userSchema);

app.set("view engine", "pug");
app.set("views", "./src/views");
app.use("/public", express.static("./src/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/test/", (_, res) => res.render("test", {
    playlist: ["qwer","asdf"], // Make sure this is an array
    chatMessages: ["qwer","asdf"] // Make sure this is an array
}));

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

async function listComments(videoId) {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?key=${apiKey}&textFormat=plainText&part=snippet&videoId=${videoId}&maxResults=10`;
    let commentList
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        commentList = Object.assign({}, data);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }

    return commentList
}


async function getVideoMetadata(videoId) {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=contentDetails,snippet`;
    let videoMetadata;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        videoMetadata = Object.assign({}, data);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }

    return videoMetadata
}

async function insertVideoDB(videoId) {
    const comment = await listComments(videoId);
    const metadata = await getVideoMetadata(videoId);
    // check whether videoId exists
    const res = await videoDB.find({ videoId: videoId }).exec();
    if (res.length === 0) {
        await videoDB.create({
            videoId: videoId,
            comment: comment,
            metadata: metadata,
        });
    }
}

async function readVideoDB(videoId) {
    const videoInfo = await videoDB.find({ videoId: videoId }).exec();
    if (videoInfo.length != 0){
        const comment = videoInfo[0].comment;
        const metadata = videoInfo[0].metadata;
        return {comment: comment, metadata: metadata}
    }
    else {
        return {comment: undefined, metadata: undefined}
    }
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
        duration: parseISODuration(duration, false)
    }
    
    return result;
}

function timeStringToSeconds(timeString) {
    var timePattern = /^(\d+):?(\d+)?:?(\d+)?$/;
    var match = timePattern.exec(timeString);
    
    var hours = parseInt(match[1]) || 0;
    var minutes = parseInt(match[2]) || 0;
    var seconds = parseInt(match[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
}


function parseISODuration(duration, onlySecond = true) {
    const regex = /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    const hours = parseInt(matches[4]) || 0;
    const minutes = parseInt(matches[5]) || 0;
    const seconds = parseInt(matches[6]) || 0;

    if (onlySecond) {
        return (hours * 60 + minutes) * 60 + seconds;
    }
    else {
        if (hours === 0) {
            return `${minutes}:${seconds}`;
        }
        else if (minutes === 0) {
            return `${seconds}`;
        }
        else {
            return `${hours}:${minutes}:${seconds}`;
        }
    }
}

function isVideoEnd(duration, currentTime) {
    const durationSeconds = timeStringToSeconds(duration);
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

    await insertVideoDB(initVideo);
    let videoInfo = await readVideoDB(initVideo);
    currentServerState.currentVideo = processResponse(videoInfo.metadata);
    
    if (initPlaylist.length != 0) {
        initPlaylist.forEach(async videoId => {
            await insertVideoDB(videoId);
            videoInfo = await readVideoDB(videoId);
            currentServerState.playlist.push(processResponse(videoInfo.metadata));
        });
    }
    
}

const currentServerState = {
    currentVideo: {},
    playerState: -1,
    playerTime: 0,
    playerVolume: 20,
    playlist: []
}

const roomList = [];
const tokenDict = {};

wsServer.on("connection", (socket) => { // socket connection
    if (socket.handshake.query.token) {
        console.log(socket.handshake.query.token)
        jwt.verify(socket.handshake.query.token, secretKey, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err);
                return;
            }
            console.log('Decoded payload:', decoded);
            // Enter room corresponding to the token
        })
    }
    wsServer.sockets.emit("room_change", publicRooms());
    socket.onAny((event) => {
        console.log(`socket Event: ${event}`);
    });
    socket.on("enter_room", (roomName, done) => {
        // Give token and nickname when enter room
        const nickname = generateUsername("", 0, 15);
        const token = jwt.sign({ nickname: socket["nickname"]}, secretKey, { expiresIn: '1d' });
        socket["JWT"] = token;
        socket["nickname"] = nickname;
        tokenDict[token] = nickname;
        console.log(token);
        console.log(nickname);

        socket.join(roomName);
        done();
        wsServer.to(roomName).emit("welcome", countRoom(roomName), socket.nickname);
        wsServer.sockets.emit("room_change", publicRooms());
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
        const videoInfo = await readVideoDB(currentServerState.currentVideo.id);
        console.log(currentServerState.playlist);
        wsServer.to(socketId).emit("initState", currentServerState, videoInfo.comment);
        wsServer.to(socketId).emit("updatePlaylist", currentServerState.playlist);
    });
    socket.on("stateChange", async (data) => {
        currentServerState.playerState = data.playerState;
        currentServerState.playerTime = data.currentTime;
        if (isVideoEnd(currentServerState.currentVideo.duration,currentServerState.playerTime) ||
            (data.playerState === 0 && currentServerState.playlist.length != 0)) { // video ends
            currentServerState.currentVideo = currentServerState.playlist.shift();
            const videoInfo = await readVideoDB(currentServerState.currentVideo.id);
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
            const videoId = getYoutubeVideoId(data.videoId)
            await insertVideoDB(videoId);
            const videoInfo = await readVideoDB(videoId);
            currentServerState.currentVideo = processResponse(videoInfo.metadata);
            currentServerState.playerTime = 0;
            // send to all members in room
            wsServer.to(data.room).emit("videoUrlChange", currentServerState, videoInfo.comment);
        }
    });
    socket.on("addPlaylist", async (data) => {
        if (data.videoId != "") {
            const videoId = getYoutubeVideoId(data.videoId);
            await insertVideoDB(videoId);
            const videoInfo = await readVideoDB(videoId);
            currentServerState.playlist.push(processResponse(videoInfo.metadata));
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

await initializeDev(); // should remove in production
httpServer.listen(3000, handleListen);