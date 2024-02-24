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

let currentServerVideoId = 'M7lc1UVf-VE';
let currentServerPlayerState = -1;
let currentServerPlayerTime = 0;
let currentServerPlayerVolume = 50;
let server_video_id = 'M7lc1UVf-VE';
let server_current_time = 0;


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

    socket.on("player_status_change", (room, status, currentTime) => {
        server_current_time = currentTime;
        socket.to(room).emit("player_status_change", status, currentTime);
        // console.log(`player status changed to ${status}, currentTime is ${currentTime}`);
    });
    socket.on("video_url_change", video_url => {
        const video_id = getYoutubeVideoId(video_url);
        wsServer.sockets.emit("video_id_change", video_id);
        console.log(`video url changed to ${video_id}`);
        server_video_id = video_id;
    });
    socket.on("get_server_status", (room,socket_id) => {
        wsServer.to(socket_id).emit("server_status", server_video_id, server_current_time);
        console.log(`send ${server_video_id} | ${server_current_time}`)
    });
});

httpServer.listen(3000, handleListen);
