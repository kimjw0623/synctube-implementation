const socket = io.connect("http://localhost:3000/?rand=" + Math.round(Math.random() * 10000000)); // io();

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");

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

const appPlayer = document.getElementById("videoUrl");
const videoForm = appPlayer.querySelector("form");
const commentDiv = document.getElementById("comment");
let lastPlayerState = -1;
let isStateChangeEvent = false;
let lastReportedTime = 0;
let currentTime = 0;
document.getElementById("player").style.display = "none";
appPlayer.style.display = "none";

// 현재 재생 시간을 정기적으로 서버에 보고하는 함수
function reportCurrentTime() {
    setInterval(() => {
        currentTime = player.getCurrentTime();
        if (true) {
            if (Math.abs(currentTime - lastReportedTime) >= 1) {
                socket.emit("syncTime", roomName, currentTime);
                lastReportedTime = currentTime;
            } //player.getPlayerState() === YT.PlayerState.PLAYING && 
        }
    }, 2000);
}

// block onPlayerStateChange for {timeOut} ms
function blockStateChange(targetFunction, timeOut=250){
    isStateChangeEvent = false;
    targetFunction();
    setTimeout(function() {
        isStateChangeEvent = true;
        console.log("now stateChange event enable!");
    }, timeOut);  
}

function onPlayerStateChange(event) {
    if (isStateChangeEvent && event.data != 3) { // 초기화 중이 아닐 때만 서버로 상태 변경 알림
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

function listComments(videoId) {
    const apiKey = 'AIzaSyCi0jYdSQvkTOP47SA0PiLJR9_kdSr9jVA';
    const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?key=${apiKey}&textFormat=plainText&part=snippet&videoId=${videoId}&maxResults=10`;
    
    const commentsUl = commentDiv.querySelector("ul");
    commentsUl.remove();
    const newCommentsUl = document.createElement("ul");
    commentDiv.appendChild(newCommentsUl);
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            data.items.forEach(commentItem => {
                const comment = commentItem.snippet.topLevelComment.snippet.textDisplay;
                const author = commentItem.snippet.topLevelComment.snippet.authorDisplayName;
                const li = document.createElement("li");
                li.innerText = `${author}: ${comment}`;
                newCommentsUl.appendChild(li);
            });
        })
        .catch(error => {
            console.error('Error fetching comments:', error);
        });
}

videoForm.addEventListener("submit", handleVideoUrlSubmit);

socket.on("videoUrlChange", videoId => {
    //console.log("get Urlchange!")
    blockStateChange(function () {
        currentTime = 0;
        listComments(videoId);
        player.loadVideoById(mediaContentUrl = String(videoId));
        player.seekTo(0, true);
        //console.log("changed!");
        player.playVideo();
    });
});

socket.on("initState", (data) => {
    // initialize player state with server data
    blockStateChange(function () {
        listComments(data.videoId);
        player.loadVideoById(mediaContentUrl = data.videoId, startSeconds = data.playerTime);
        // player.seekTo(, true);
        console.log(data.playerTime);
        if (data.playerState === YT.PlayerState.PLAYING) {
            player.playVideo();
        } else if (data.playerState === YT.PlayerState.PAUSED) {
            player.pauseVideo();
        }
        console.log(data);
    });
    document.getElementById("player").style.display = "";
    appPlayer.style.display = "";
    reportCurrentTime();
    console.log("init done!");
});

socket.on("stateChange", data => {
    const serverTime = data.currentTime;
    const serverStatus = data.playerState;
    // console.log(`get ${serverTime}, ${serverStatus}`);
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

socket.on("SyncTime", data => {
    const serverTime = data.currentTime;
    console.log(`get ${serverTime}`);
    blockStateChange(function () {
        if (Math.abs(serverTime - player.getCurrentTime()) > 0.5) {
            player.seekTo(serverTime, true);
        }
    });
});