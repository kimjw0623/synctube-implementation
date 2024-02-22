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
    socket.emit("enter_room", input.value, showRoom);
    roomName = input.value;

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


function handleVideoUrlSubmit(event){
    event.preventDefault();
    const input = videoForm.querySelector("input");
    socket.emit("video_url_change", input.value);
    console.log("video changed! - submit")
    input.value = "";
}

videoForm.addEventListener("submit", handleVideoUrlSubmit);

function pauseVideo(){
    player.pauseVideo();
}
function playVideo(){
    player.playVideo();
}
function getCurrentTime(){
    player.getCurrentTime();
}

socket.on("video_id_change", video_id => {
    console.log(`video_id: {video_id}`);
    player.loadVideoById(mediaContentUrl=String(video_id));
});

socket.on("player_status_change", (status, current_time) => {
    // status는 마우스를 누르고 난 뒤의 상태
    // -1 – 시작되지 않음
    // 0 – 종료
    // 1 – 재생 중
    // 2 – 일시중지
    // 3 – 버퍼링
    // 5 – 동영상 신호
    console.log(`status changed: ${status}`);
    if (status === 2){
        // player.seekTo(current_time,false)
        pauseVideo();
    }
    else if (status === 1){
        console.log(`time: ${current_time}`)
        // player.seekTo(current_time,false)
        playVideo();
    }
});
