import path from "path";
// const __dirname = path.resolve();
import http from "http";
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";

import express from "express";
const app = express();

app.set("view engine", "pug");
app.set("views", "./src/views");
app.use("/public", express.static("./src/public"));
app.get("/", (_, res) => res.render("home"));
// app.get("/*", (_, res) => res.redirect("/"));
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
instrument(wsServer, {
    auth: false
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
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

function getYoutubeVideoId(url) {
    var searchParams = new URLSearchParams(new URL(url).search);
    return searchParams.get("v");
}

// ["K49vI-88QlU","M7lc1UVf-VE","4fjqMq_nPAo"]
let currentServerState = {
    videoId: "CRMOwaIkYSY",
    playerState: -1,
    playerTime: 0,
    playerVolume: 20,
    playlist: ["M7lc1UVf-VE","4fjqMq_nPAo","dHwhfpN--Bk"],
}

wsServer.on("connection", (socket) => { // socket 연결이 성립했을 때:
    socket["nickname"] = "Anon";
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
    socket.on("initState", (socketId) => {
        // emit to client with certain socketId
        wsServer.to(socketId).emit("initState", currentServerState);
        wsServer.to(socketId).emit("updatePlaylist", currentServerState.playlist);
    });
    socket.on("stateChange", (data) => {
        currentServerState.playerState = data.playerState;
        currentServerState.playerTime = data.currentTime;
        if (data.playerState === 0 && currentServerState.playlist.length != 0) { // video ends
            console.log("end!!!!!!!!!!!!!!!!")
            currentServerState.videoId = currentServerState.playlist.shift();
            wsServer.to(data.room).emit("videoUrlChange", currentServerState.videoId);
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
    socket.on("videoUrlChange", (data) => {
        const videoId = getYoutubeVideoId(data.videoId)
        currentServerState.videoId = videoId;
        currentServerState.playerTime = 0;
        // send to all members in room
        wsServer.to(data.room).emit("videoUrlChange", videoId);
    });
    socket.on("addPlaylist", (data) => {
        const playlistVideoId = getYoutubeVideoId(data.videoId);
        currentServerState.playlist.push(playlistVideoId);
        wsServer.to(data.room).emit("updatePlaylist", currentServerState.playlist)
    })
});

httpServer.listen(3000, handleListen);
