const socket = io.connect("http://localhost:3000");// io();

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room")

room.hidden = true;
let roomName;

function addMessage(message) {
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${value}`); // because of L24, input.value become "" before addMessage!
    });
    input.value = ""
}

function handleNameSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#name input");
    const value = input.value
    socket.emit("nickname", input.value, roomName);
    input.value = ""
}

function showRoom() {
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    msgForm.addEventListener("submit", handleMessageSubmit);
    nameForm.addEventListener("submit", handleNameSubmit);
}

function handleRoomSubmit(event) {
    event.preventDefault();
    const input = form.querySelector("input");
    roomName = input.value;
    socket.emit("enter_room", input.value, showRoom);
    socket.emit("initState", socket.id);
    input.value = "";
    
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome",(newCount, user) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}; Users ${newCount}`;
    addMessage(`${user} joined!`);
});
socket.on("bye", (newCount, user) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}; Users ${newCount}`;
    addMessage(`${user} Bye!`);
});

// Same code:
// socket.on("new_message", (msg) => {
//     addMessage(msg)
// })
socket.on("new_message", (a, newCount) => {
    console.log(a);
    addMessage(a)});
socket.on("room_change", (rooms) => {
    // if(rooms.length === 0){
    //     roomList.innerHTML = "";
    //     return;
    // }
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = ""; // 비워주기
    rooms.forEach(room => {
        li = document.createElement("li");
        li.innerText = room;
        roomList.appendChild(li);
    })
});

// --------------------------------------- //

const appPlayer = document.getElementById("video_url");
const videoForm = appPlayer.querySelector("form");
let lastPlayerState = -1;
let isStateChangeEvent = false;
let lastReportedTime = 0;

// 현재 재생 시간을 정기적으로 서버에 보고하는 함수
function reportCurrentTime() {
    setInterval(() => {
        var currentTime = player.getCurrentTime();
        if (player.getPlayerState() === YT.PlayerState.PLAYING && Math.abs(currentTime - lastReportedTime) >= 1) {
            socket.emit("syncTime", currentTime);
            lastReportedTime = currentTime;
        }
    }, 1000); // 매 1초마다 실행
}

// block onPlayerStateChange for {timeOut} ms
function blockStateChange(targetFunction, timeOut=500){
    isStateChangeEvent = false;
    targetFunction();
    setTimeout(function() {
        isStateChangeEvent = true;
        console.log("now stateChange event enable!");
    }, timeOut);  
}

function onPlayerStateChange(event) {
    if (isStateChangeEvent) { // 초기화 중이 아닐 때만 서버로 상태 변경 알림
        socket.emit("stateChange", {
            room: roomName,
            playerState: event.data,
            currentTime: player.getCurrentTime(),
        });
    }
}

function handleVideoUrlSubmit(event){
    event.preventDefault();
    const input = videoForm.querySelector("input");
    socket.emit("videoUrlChange", {
        videoId: input.value,
        room: roomName
    });
    console.log("video changed! - submit")
    input.value = "";
}

videoForm.addEventListener("submit", handleVideoUrlSubmit);

socket.on("videoUrlChange", videoId => {
    blockStateChange(function () {
        player.loadVideoById(mediaContentUrl = String(videoId));
        player.playVideo();
    });
});

socket.on("initState", (data) => {
    // initialize with server data
    blockStateChange(function () {
        player.loadVideoById(mediaContentUrl = data.videoId, startSeconds = data.currentTime);
        if (data.playerState === YT.PlayerState.PLAYING) {
            // player.seekTo(data.currentTime, true);
            player.playVideo();
        } else if (data.playerState === YT.PlayerState.PAUSED) {
            // player.seekTo(data.currentTime, true);
            player.pauseVideo();
        }
        console.log(data);
    });
    reportCurrentTime();
    console.log("init done!");
});

socket.on("stateChange", data => {
    const serverTime = data.currentTime;
    const serverStatus = data.playerState;

    blockStateChange(function () {
        if (Math.abs(serverTime - player.getCurrentTime()) > 0.25) {
            player.seekTo(serverTime, true);
        }
        if (serverStatus === YT.PlayerState.PLAYING) {
            player.playVideo();
        }
        else if (serverStatus === YT.PlayerState.PAUSED) {
            player.pauseVideo();
        }
    });
});