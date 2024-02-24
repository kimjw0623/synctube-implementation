import path from 'path';
// const __dirname = path.resolve();
import http from "http";
import {Server} from "socket.io";
import {instrument} from '@socket.io/admin-ui';

import express from "express";
const app = express();

app.set("view engine", "pug");
app.set("views", "./src/views");
app.use("/public", express.static("./src/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

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

let currentServerState = {
    videoId: "M7lc1UVf-VE",
    playerState: -1,
    playerTime: 0,
    playerVolume: 20,
}

wsServer.on("connection", (socket) => { // socket 연결이 성립했을 때:
    socket["nickname"] = "Anon";
    // TODO: 아이디 리스트 보여주도록 구현
    wsServer.sockets.emit("room_change", publicRooms()); // 처음 입장했을 떄 방 상태 보여줄 수 있음!
    socket.onAny((event) => {
        console.log(`socket Event: ${event}`);
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
    });
    socket.on("stateChange", (data) => {
        currentServerState.playerState = data.playerState;
        currentServerState.currentTime = data.currentTime;
        socket.to(data.room).emit("stateChange", data);
    });
    socket.on("syncTime", (currentTime) => {
        // update serverTime
        currentServerState.currentTime = currentTime;
        const data = {
            currentTime: currentTime,
            playerState: currentServerState.playerState
        };
        socket.to(data.room).emit("stateChange", data);
        console.log(`time: ${currentTime}`)
    });
    socket.on("videoUrlChange", (data) => {
        const videoId = getYoutubeVideoId(data.videoId)
        currentServerState.videoId = videoId;
        // send to all members in room
        wsServer.to(data.room).emit("videoUrlChange", videoId);
    });
});

httpServer.listen(3000, handleListen);
