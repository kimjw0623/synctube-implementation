
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
const changeIdForm = document.getElementById("changeId");

document.getElementById("main").style.display = "none";
appPlayer.style.display = "none";
playlistChat.style.display = "none";
room.hidden = true;

function getRandomColorHex() {
    const randomColor = () => Math.floor(Math.random() * 256).toString(16);
    const color = `#${randomColor()}${randomColor()}${randomColor()}`;
    return color.length < 7 ? color + '0' : color;
}

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

    if (message.nickname === nickname) {
        message.nickname = "You";
    }
    const firstWordElement = document.createElement("span");
    firstWordElement.style.color = message.color;
    firstWordElement.textContent = message.nickname+": ";

    li.appendChild(firstWordElement);
    li.appendChild(document.createTextNode(message.content));
    ul.appendChild(li);
}

function loadMessage(messages) {
    const ul = room.querySelector("ul");
    const oldMessages = ul.querySelectorAll("li");
    oldMessages.forEach(msg => {
        msg.remove();
    });
    messages.forEach(message => {

        const li = document.createElement("li");
        if (message.nickname === nickname) {
            message.nickname = "You";
        }
        const firstWordElement = document.createElement("span");
        firstWordElement.style.color = message.color;
        firstWordElement.textContent = message.nickname+": ";

        li.appendChild(firstWordElement);
        li.appendChild(document.createTextNode(message.content));
        ul.appendChild(li);
    });
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = chatForm.querySelector("input");
    const value = input.value
    const chatColor = localStorage.getItem("chatColor");
    socket.emit("newMessage", input.value, roomName, chatColor, () => {
        const messageData = {
            "nickname": nickname,
            "content": value,
            "color": chatColor
        }
        addMessage(messageData);
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
    if (!localStorage.getItem("chatColor")) {
        localStorage.setItem("chatColor", getRandomColorHex());
    }
    socket.emit("enterRoom", roomName, socket.id, showRoom);
    input.value = "";
}

function handleHomeSubmit() {
    // Exit room only (maintain socket Object; only available at server)
    socket.emit('leaveRoom', roomName); 
    localStorage.removeItem("token");
    localStorage.removeItem("chatColor");
    isStateChangeEvent = false;
    player.stopVideo();
    if (commentIntervalId !== null) {
        clearInterval(commentIntervalId);
    }
    // UI
    room.hidden = true;
    document.getElementById("main").style.display = "none";
    appPlayer.style.display = "none";
    playlistChat.style.display = "none";
    document.getElementById("welcome").hidden = false;
}

function handleChangeIdSubmit(event) {
    event.preventDefault();
    const input = changeIdForm.querySelector("input");
    socket.emit("changeUserId", input.value);
    nickname = input.value;
    input.value = "";
}

socket.on('issueToken', (token, tokenNickname) => {
    nickname = tokenNickname;
    localStorage.setItem('token', token);
});

socket.on("enterRoomWithToken", (room, tokenNickname, roomMessage) => {
    console.log("Reconnected with token.");
    roomName = room;
    nickname = tokenNickname;
    socket.emit("enterRoom", room, socket.id, showRoom);
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

socket.on("newMessage", (messageData, newCount) => {
    addMessage(messageData);
});

// If player enter/exit the room
socket.on("roomChange", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const roomListSpan = createElement("span", room, "font-weight:bold; display:block;");
        roomList.appendChild(roomListSpan);
    })
});

changeIdForm.addEventListener("submit", handleChangeIdSubmit);
homeButton.addEventListener("click", handleHomeSubmit);
form.addEventListener("submit", handleRoomSubmit);
