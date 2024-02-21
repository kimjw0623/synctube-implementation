import path from 'path';
// const __dirname = path.resolve();
import http from "http";
import {Server} from "socket.io";
import {instrument} from '@socket.io/admin-ui';

// import WebSocket, { WebSocketServer } from "ws";
import express from "express";
const app = express();

app.set("view engine", "pug");
app.set("views", "./src/views");
app.use("/public", express.static("./src/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:3000`);

// app.listen(3000, handleListen);

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
    // console.log(sids.size, rooms.size);
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

wsServer.on("connection", (socket) => { // socket 연결이 성립했을 때:
    socket["nickname"] = "Anon";
    // localStorage.setItem["ids",]; 아이디 리스트 보여주도록 구현
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
});

// const wss = new WebSocketServer({ server })

// const sockets = [];

// wss.on("connection", (socket) => {
//     sockets.push(socket);
//     socket["nickname"] = "Anon";
//     console.log("connected to browser!")
//     socket.on("close", () => {
//         console.log("disconnected from browser!");
//     });
//     socket.on("message", (msg) => {
//         const messageString = msg.toString('utf8');
//         console.log(messageString);
//         const message = JSON.parse(messageString);
//         switch (message.type) {
//             case "new_message":
//                 sockets.forEach((aSocket) =>
//                     aSocket.send(`${socket.nickname}: ${message.payload}`)
//                 );
//                 break;
//             case "nickname":
//                 socket["nickname"] = message.payload;
//                 break;
//         }
//     });
// });

httpServer.listen(3000, handleListen);

