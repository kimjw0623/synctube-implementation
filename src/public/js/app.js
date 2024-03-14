
let token = localStorage.getItem('token');
let query = token ? { query: `token=${token}` } : {};
let socket = io.connect('', query);
let roomName = 1;
let nickname = "Default Nickname"

const appPlayer = document.getElementById("videoUrl");
const playlistChat = document.getElementById("playlistChat");
const homeButton = document.getElementById("home");
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const chatForm = document.getElementById("chatForm");
const userList = document.getElementById("userList");

document.getElementById("main").style.display = "none";
appPlayer.style.display = "none";
playlistChat.style.display = "none";
room.hidden = true;

function createElement(type, text, style) {
    const newElement = document.createElement(type);
    newElement.innerText = text;
    newElement.style.cssText = style;
    return newElement;
}

function loadUserList(data) {
    const oldUsers = userList.querySelectorAll("li");
    oldUsers.forEach(user => {
        user.remove();
    });
    data.forEach(user => {
        const li = createElement("li", user, "font-size: 15px");
        userList.appendChild(li);
    });
}

function addMessage(message) {
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function loadMessage(messages) {
    const ul = room.querySelector("ul");
    const oldMessages = ul.querySelectorAll("li");
    oldMessages.forEach(msg => {
        msg.remove();
    });
    messages.forEach(data => {
        const li = document.createElement("li");
        if (data.nickname === nickname) {
            data.nickname = "You";
        }
        li.innerText = `${data.nickname}: ${data.content}`;
        ul.appendChild(li);
    });
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = chatForm.querySelector("input");
    const value = input.value
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${value}`);
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
    //h3.innerText = `Room ${roomName}`;
    //const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    chatForm.addEventListener("submit", handleMessageSubmit);
    // playlist, chat
    document.getElementById("playlistForm").hidden = false;
    document.getElementById("room").hidden = true;
    handleSwitchChatPlaylist();
    handleSortablePlaylist();
}

function handleRoomSubmit(event) {
    event.preventDefault();
    const input = form.querySelector("input");
    roomName = input.value;
    if (!localStorage.getItem("token")) {
        socket.emit("requestToken", roomName);
    }
    socket.emit("enterRoom", roomName, showRoom);
    socket.emit("initState", socket.id);
    input.value = "";
}

function handleHomeSubmit() {
    socket.disconnect(); // Exit room
    localStorage.removeItem("token");
    isStateChangeEvent = false;
    player.stopVideo();
    // UI
    room.hidden = true;
    document.getElementById("main").style.display = "none";
    appPlayer.style.display = "none";
    playlistChat.style.display = "none";
    document.getElementById("welcome").hidden = false;
}

socket.on('issueToken', (token, tokenNickname) => {
    nickname = tokenNickname;
    localStorage.setItem('token', token);
});

socket.on("enterRoomWithToken", (room, tokenNickname, roomMessage) => {
    console.log("Reconnected with token.");
    roomName = room;
    nickname = tokenNickname;
    socket.emit("enterRoom", room, showRoom);
    socket.emit("initState", socket.id);
    //loadMessage(roomMessage);
});

socket.on("welcome",(users, user, messages) => {
    const h3 = room.querySelector("h3");
    loadMessage(messages);
    loadUserList(users);
    //addMessage(`${user} joined!`);
});

socket.on("bye", (users, user) => {
    const h3 = room.querySelector("h3");
    loadUserList(users);
    //addMessage(`${user} Bye!`);
});

socket.on("new_message", (a, newCount) => {
    addMessage(a)
});

socket.on("roomChange", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const roomListSpan = createElement("span", room, "font-weight:bold; display:block;");
        roomList.appendChild(roomListSpan);
    })
});

homeButton.addEventListener("click", handleHomeSubmit);
form.addEventListener("submit", handleRoomSubmit);
