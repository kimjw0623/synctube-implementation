import path from "path";
import http from "http";
import {Server} from "socket.io";
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import mongoose from "mongoose";
const app = express();

dotenv.config();

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
        const response = await fetch(apiUrl); // 응답이 도착할 때까지 대기
        const data = await response.json(); // 응답을 JSON으로 변환할 때까지 대기
        commentList = Object.assign({}, data);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }

    return commentList
}


async function getVideoMetadata(videoId) {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}`;
    let videoMetadata;
    try {
        const response = await fetch(apiUrl); // 응답이 도착할 때까지 대기
        const data = await response.json(); // 응답을 JSON으로 변환할 때까지 대기
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
    //console.log(res);
    console.log(res.length);
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
    console.log(videoInfo.length);
    if (videoInfo.length != 0){
        const comment = videoInfo[0].comment; //JSON.parse(videoInfo[0].comment);
        const metadata = videoInfo[0].metadata; //JSON.parse();
        return {comment: comment, metadata: metadata}
    }
    else {
        return undefined
    }
}

const currentServerState = {
    videoId: "1EJcaxYMZzQ",
    playerState: -1,
    playerTime: 0,
    playerVolume: 20,
    playlist: ["CRMOwaIkYSY","M7lc1UVf-VE", "4fjqMq_nPAo", "dHwhfpN--Bk","K49vI-88QlU"],
}


wsServer.on("connection", (socket) => { // socket 연결이 성립했을 때:
    socket["nickname"] = "Anon";
    // In production, these insert code should remove
    if (currentServerState.playlist.length != 0) {
        currentServerState.playlist.forEach(videoId => {
            insertVideoDB(videoId)
        });
    }
    if (currentServerState.videoId != "") {
        insertVideoDB(currentServerState.videoId);
    }

    // TODO: 아이디 리스트 보여주도록 구현
    wsServer.sockets.emit("room_change", publicRooms()); // 처음 입장했을 떄 방 상태 보여줄 수 있음!
    socket.onAny((event) => {
        console.log(`socket Event: ${event}`);
        // console.log(currentServerState);
    });
    socket.on("enter_room", (roomName, done) => {
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
        const videoInfo = await readVideoDB(currentServerState.videoId);
        wsServer.to(socketId).emit("initState", currentServerState, videoInfo.comment);
        wsServer.to(socketId).emit("updatePlaylist", currentServerState.playlist);
    });
    socket.on("stateChange", async (data) => {
        currentServerState.playerState = data.playerState;
        currentServerState.playerTime = data.currentTime;
        // TODO: if playerTime === video length: go next video!
        if (data.playerState === 0 && currentServerState.playlist.length != 0) { // video ends
            console.log("video end!!!!!!!!!!!!!!!!")
            currentServerState.videoId = currentServerState.playlist.shift();
            const videoInfo = await readVideoDB(currentServerState.videoId);
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
            // get video data from DB!
            currentServerState.videoId = videoId;
            await insertVideoDB(videoId);
            console.log(videoId);
            const videoInfo = await readVideoDB(currentServerState.videoId);
            currentServerState.playerTime = 0;
            // send to all members in room
            wsServer.to(data.room).emit("videoUrlChange", currentServerState, videoInfo.comment);
        }
    });
    socket.on("addPlaylist", async (data) => {
        if (data.videoId != "") {
            const playlistVideoId = getYoutubeVideoId(data.videoId);
            currentServerState.playlist.push(playlistVideoId);
            await insertVideoDB(playlistVideoId);
            wsServer.to(data.room).emit("updatePlaylist", currentServerState.playlist)
        }
    })
    socket.on("changePlaylist", (data, room) => {
        currentServerState.playlist = data;
        wsServer.to(room).emit("updatePlaylist", currentServerState.playlist)
    })
});

httpServer.listen(3000, handleListen);
