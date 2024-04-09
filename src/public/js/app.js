let token = localStorage.getItem("token");
let query = token ? { query: `token=${token}` } : {};
let socket = io.connect("", query);
let roomName = 1;
let nickname = "Default Nickname";

const appPlayer = document.getElementById("videoUrl");
const playlistChat = document.getElementById("playlistChat");
const homeButton = document.getElementById("home");
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");

function setupEventListeners() {
    homeButton.addEventListener("click", handleHomeSubmit);
    form.addEventListener("submit", handleRoomSubmit);
}

function initUI() {
    document.getElementById("main").style.display = "none";
    appPlayer.style.display = "none";
    playlistChat.style.display = "block";
    room.hidden = true;
}

function initRoomSocketListener(socket) {
    socket.on("issueToken", (token, tokenNickname) => {
        nickname = tokenNickname;
        localStorage.setItem("token", token);
    });

    socket.on("enterRoomWithToken", (room, tokenNickname, roomMessage) => {
        console.log("Reconnected with token.");
        const chatColor = localStorage.getItem("chatColor");
        roomName = room;
        nickname = tokenNickname;
        data = {
            roomName: roomName,
            userColor: chatColor,
        };
        socket.emit("enterRoom", data, socket.id, showRoom);
        videoPlayer = new VideoPlayer(socket, roomName);
        initPlayerSocketListener(socket,videoPlayer);
    });

    socket.on("welcome", (users, user, messages) => {
        const h3 = room.querySelector("h3");
        videoPlayer = new VideoPlayer(socket, roomName);
        initPlayerSocketListener(socket,videoPlayer);
        client.loadMessage(messages);
        client.loadUserList(users);
        //addMessage(`${user} joined!`);
    });

    // Reload roomlist if any player enters/exits the room
    socket.on("roomChange", (rooms) => {
        const roomList = welcome.querySelector("ul");
        roomList.innerHTML = "";
        rooms.forEach((room) => {
            const roomListSpan = createElement(
                "span",
                room,
                "font-weight:bold; display:block;"
            );
            roomList.appendChild(roomListSpan);
        });
    });
}

function initialize() {
    setupEventListeners();
    initUI();
}

initialize();
const client = new Client(socket);
let videoPlayer;
initRoomSocketListener(socket);

function showRoom() {
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    //h3.innerText = `Room ${roomName}`;
    //const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    // playlist, chat
    document.getElementById("playlistForm").hidden = false;
    // document.getElementById("room").hidden = true;
    videoPlayer.handleSwitchChatPlaylist();
    videoPlayer.handleSortablePlaylist();
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
    const chatColor = localStorage.getItem("chatColor");
    data = {
        roomName: roomName,
        userColor: chatColor,
    };
    socket.emit("enterRoom", data, socket.id, showRoom);
    input.value = "";
}

function handleHomeSubmit() {
    // Exit room only (maintain socket Object; only available at server)
    function leaveRoom() {
        socket.emit("leaveRoom", roomName);
        localStorage.removeItem("token");
        localStorage.removeItem("chatColor");
        player.stopVideo();
        if (VideoPlayer.commentIntervalId !== null) {
            clearInterval(VideoPlayer.commentIntervalId);
        }
        // UI
        if (VideoPlayer.syncIntervalId !== null) {
            clearInterval(VideoPlayer.syncIntervalId);
        }
        room.hidden = true;
        document.getElementById("main").style.display = "none";
        appPlayer.style.display = "none";
        playlistChat.style.display = "block";
        document.getElementById("welcome").hidden = false;
    }
    videoPlayer.blockStateChange(leaveRoom, 2000);
}

function getRandomColorHex() {
    const randomColor = () => Math.floor(Math.random() * 256).toString(16);
    const color = `#${randomColor()}${randomColor()}${randomColor()}`;
    return color.length < 7 ? color + "0" : color;
}