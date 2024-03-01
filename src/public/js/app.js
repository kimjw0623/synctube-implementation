const socket = io.connect("http://localhost:3000/?rand=" + Math.round(Math.random() * 10000000)); // io();

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const chatForm = document.getElementById("chatForm");

room.hidden = true;
let roomName = 1;

function addMessage(message) {
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = chatForm.querySelector("input");
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
    //h3.innerText = `Room ${roomName}`;
    //const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    chatForm.addEventListener("submit", handleMessageSubmit);
    //nameForm.addEventListener("submit", handleNameSubmit);
    // playlist, chat
    document.getElementById("playlistForm").hidden = false;
    document.getElementById("room").hidden = true;
    handleSwitchChatPlaylist();
    handleSortablePlaylist();
    console.log("event setting!")
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
    //h3.innerText = `Room ${roomName}; Users ${newCount}`;
    addMessage(`${user} joined!`);
});
socket.on("bye", (newCount, user) => {
    const h3 = room.querySelector("h3");
    //h3.innerText = `Room ${roomName}; Users ${newCount}`;
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
const playButton = appPlayer.querySelector("#playButton");
const addPlaylistButton = document.querySelector("#addButton");
const commentDiv = document.getElementById("comment");
const playlistChat = document.getElementById("playlistChat");

let lastPlayerState = -1;
let isStateChangeEvent = false;
let lastReportedTime = 0;
let currentTime = 0;
document.getElementById("main").style.display = "none";
appPlayer.style.display = "none";
playlistChat.style.display = "none";


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
    const input = appPlayer.querySelector("#playNow");
    socket.emit("videoUrlChange", {
        videoId: input.value,
        room: roomName
    });
    console.log("video changed! - submit")
    input.value = "";
}

function listComments(data) {
    const commentsUl = commentDiv.querySelector("ul");
    commentsUl.remove();
    const newCommentsUl = document.createElement("ul");
    //newCommentsUl.className = "list-group"; // https://getbootstrap.com/docs/5.0/components/list-group/
    commentDiv.appendChild(newCommentsUl);
    console.log(data.videoComment);
    data.videoComment.items.forEach(commentItem => {
        const comment = commentItem.snippet.topLevelComment.snippet.textDisplay;
        const author = commentItem.snippet.topLevelComment.snippet.authorDisplayName;
        const li = document.createElement("li");
        li.innerText = `${author}: ${comment}`;
        //li.className = "list-group-item";
        newCommentsUl.appendChild(li);
    });
}

function handlePlaylistSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("playNow");
    socket.emit("addPlaylist", {
        videoId: input.value,
        room: roomName
    });
    console.log("add playlist! - submit")
    input.value = "";
}

function handleSwitchChatPlaylist() {
    const radios = document.querySelectorAll("label[name='radio']");
	radios.forEach((radio) => {
        radio.addEventListener("click", (e) => {
            const current = e.currentTarget;
            if (current.querySelector("input").id === "option1") {
                document.getElementById("playlistForm").hidden = false
                document.getElementById("room").hidden = true
            }
            else {
                document.getElementById("playlistForm").hidden = true
                document.getElementById("room").hidden = false
            }
		});
	});
};

function handleSortablePlaylist() {
    const sortableList = document.getElementById("sortable-list");
    console.log("asdf")
    sortableList.addEventListener("drop", (e) => {
        let idList = [];
        sortableList.querySelectorAll("li").forEach((id) => {
            idList.push(id.innerText)
        })
        socket.emit("changePlaylist", idList, roomName)
        console.log(idList);
	});
};

playButton.addEventListener("click", handleVideoUrlSubmit);
addPlaylistButton.addEventListener("click", handlePlaylistSubmit);

socket.on("videoUrlChange", data => {
    //console.log("get Urlchange!")
    blockStateChange(function () {
        currentTime = 0;
        listComments(data);
        player.loadVideoById(mediaContentUrl = String(data.videoId));
        player.seekTo(0, true);
        //console.log("changed!");
        player.playVideo();
    });
});

socket.on("initState", (data) => {
    // initialize player state with server data
    blockStateChange(function () {
        console.log(data);
        listComments(data);
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
    document.getElementById("main").style.display = "";
    appPlayer.style.display = "";
    playlistChat.style.display = "";
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

socket.on("updatePlaylist", (data) => {
    const playlistList = playlistForm.querySelector("ol");
    const sortableList = document.getElementById("sortableList");
    playlistList.remove();
    const newPlaylistList = document.createElement("ol");
    newPlaylistList.className = "list-group"
    newPlaylistList.id = "sortable-list"
    playlistForm.insertBefore(newPlaylistList,sortableList);
    data.forEach(videoItem => {
        const li = document.createElement("li");
        li.innerText = `${videoItem}`;
        li.className = "list-group-item";
        newPlaylistList.appendChild(li);
    });
    sortableList;
    handleSortablePlaylist();
    var sortable = new Sortable(document.getElementById('sortable-list'), {
        animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
        ghostClass: 'sortable-ghost' // Class name for the drop placeholder
    });
     // important!!! eventlist has gone
    // get first child: playlistForm.querySelector("ol").firstChild.innerText
});
