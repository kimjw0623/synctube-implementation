let token = localStorage.getItem('token');
let query = token ? { query: `token=${token}` } : {};
let socket = io.connect('http://localhost:3000', query);
let roomName = 1;

const appPlayer = document.getElementById("videoUrl");
const playButton = appPlayer.querySelector("#playButton");
const addPlaylistButton = document.querySelector("#addButton");
const commentDiv = document.getElementById("comment");
const playlistChat = document.getElementById("playlistChat");
const homeButton = document.getElementById("home");
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const chatForm = document.getElementById("chatForm");

let isStateChangeEvent = false;
let lastReportedTime = 0;
let currentTime = 0;
let isPlayerReady = false;

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

socket.on('issueToken', (token) => {
    localStorage.setItem('token', token);
});

socket.on("enterRoomWithToken", (room) => {
    console.log("Reconnected with token.");
    roomName = room;
    socket.emit("enterRoom", room, showRoom);
    socket.emit("initState", socket.id);
});

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

socket.on("new_message", (a, newCount) => {
    addMessage(a)
});

socket.on("roomChange", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const roomListSpan = document.createElement("span");
        roomListSpan.innerText = room;
        roomListSpan.style.cssText = 'font-weight:bold; display:block;';
        roomList.appendChild(roomListSpan);
    })
});

// -------------player---------------- //

function onPlayerReady() {
    isPlayerReady = true;
}

function reportCurrentTime() {
    setInterval(() => {
        currentTime = player.getCurrentTime();
        if (true) {
            if (Math.abs(currentTime - lastReportedTime) >= 1) {
                socket.emit("syncTime", roomName, currentTime);
                lastReportedTime = currentTime;
            }
        }
    }, 2000);
}

// block onPlayerStateChange for {timeOut} ms
function blockStateChange(targetFunction, timeOut=200){
    isStateChangeEvent = false;
    targetFunction();
    setTimeout(function() {
        isStateChangeEvent = true;
    }, timeOut);  
}

function onPlayerStateChange(event) {
    if (isStateChangeEvent && event.data != 3) {
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
    console.log("video changed! - submit");
    input.value = "";
}

function listComments(videoComment) {
    const commentsUl = commentDiv.querySelector("ul");
    commentsUl.remove();
    const newCommentsUl = document.createElement("ul");
    commentDiv.appendChild(newCommentsUl);
    videoComment.items.forEach(commentItem => {
        const comment = commentItem.snippet.topLevelComment.snippet.textDisplay;
        const author = commentItem.snippet.topLevelComment.snippet.authorDisplayName;
        const li = document.createElement("li");
        const commentUserSpan = document.createElement("span");
        commentUserSpan.innerText = author;
        commentUserSpan.style.cssText = 'font-weight:bold; display:block; margin-left:10px;';
        const commentTextSpan = document.createElement("span");
        commentTextSpan.innerText = comment;
        commentTextSpan.style.cssText = 'display:block; margin-left:10px;';
        li.appendChild(commentUserSpan);
        li.appendChild(commentTextSpan);
        newCommentsUl.appendChild(li);
    });
}



function setVideoTitle(data) {
    // Remove previous video description
    const videoTitle = document.getElementById("videoTitle");
    const videoTitleDiv = videoTitle.querySelectorAll("div");
    videoTitleDiv.forEach(span => {
        span.remove();
    });
    const videoChannel = document.getElementById("videoChannel");
    const videoChannelDiv = videoChannel.querySelectorAll("div");
    videoChannelDiv.forEach(span => {
        span.remove();
    });
    
    // Append current video description
    const videoTitleSpan = createElement("div", data.currentVideo.title, "font-weight:bold; margin-left:10px; font-size: 20px");
    const videoChannelSpan = createElement("div", data.currentVideo.channelTitle, "display:block; margin-left:10px; font-size: 12px");
    const roomNameSpan = createElement("div", `Room ${roomName}`, "font-weight:bold; margin-left: auto; font-size: 20px");
    
    videoTitle.appendChild(videoTitleSpan);
    videoTitle.appendChild(roomNameSpan);
    videoChannel.appendChild(videoChannelSpan);
}

function handlePlaylistSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("playNow");
    socket.emit("addPlaylist", {
        videoId: input.value,
        room: roomName
    });
    console.log("add playlist! - submit");
    input.value = "";
}

function handleSwitchChatPlaylist() {
    const radios = document.querySelectorAll("label[name='radio']");
	radios.forEach((radio) => {
        radio.addEventListener("click", (e) => {
            const current = e.currentTarget;
            if (current.querySelector("input").id === "option1") {
                document.getElementById("playlistForm").hidden = false;
                document.getElementById("room").hidden = true;
            }
            else {
                document.getElementById("playlistForm").hidden = true;
                document.getElementById("room").hidden = false;
            }
		});
	});
};

function handleSortablePlaylist() {
    const sortableList = document.getElementById("sortable-list");
    sortableList.addEventListener("drop", (e) => {
        let idList = [];
        sortableList.querySelectorAll("li").forEach((id) => {
            idList.push(id.querySelector("img").alt);
        })
        socket.emit("changePlaylist", idList, roomName);
	});
};

function handleDeletePlaylist() {
    let idList = [];
    const sortableList = document.getElementById("sortable-list");
    sortableList.querySelectorAll("li").forEach((id) => {
        idList.push(id.querySelector("img").alt);
    })
    socket.emit("changePlaylist", idList, roomName);
}

playButton.addEventListener("click", handleVideoUrlSubmit);
addPlaylistButton.addEventListener("click", handlePlaylistSubmit);
homeButton.addEventListener("click", handleHomeSubmit);
form.addEventListener("submit", handleRoomSubmit);

socket.on("videoUrlChange", (data, videoComment) => {
    blockStateChange(function () {
        currentTime = 0;
        listComments(videoComment);
        setVideoTitle(data);
        player.loadVideoById(mediaContentUrl = String(data.currentVideo.id));
        player.seekTo(0, true);
        player.playVideo();
    });
});

socket.on("initState", (data, videoComment) => {
    // initialize player state with server data
    const waitForPlayerReady = setInterval(() => {
        if (isPlayerReady) {
            clearInterval(waitForPlayerReady);
            blockStateChange(function () {
                listComments(videoComment);
                setTimeout(function () {
                    player.loadVideoById(mediaContentUrl = data.currentVideo.id, startSeconds = data.playerTime);
                    if (data.playerState === YT.PlayerState.PLAYING) {
                        player.playVideo();
                    } else if (data.playerState === YT.PlayerState.PAUSED) {
                        player.pauseVideo();
                    }
                }, 50);
            });
            document.getElementById("main").style.display = "";
            appPlayer.style.display = "";
            playlistChat.style.display = "";
            reportCurrentTime();
            setVideoTitle(data);
            console.log("init done!");
        }
    }, 100);
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

socket.on("SyncTime", data => {
    const serverTime = data.currentTime;
    console.log(`get ${serverTime}`);
    blockStateChange(function () {
        if (Math.abs(serverTime - player.getCurrentTime()) > 0.5) {
            player.seekTo(serverTime, true);
        }
    });
});

function createVideoListItem(videoItem) {
    const li = document.createElement("li");
    li.className = "list-group-item";
    
    const img = document.createElement("img");
    img.src = videoItem.thumbnailUrl;
    img.alt = videoItem.id;
    img.style.cssText = 'width:100px; height:auto; float:left;';

    const titleSpan = document.createElement("span");
    titleSpan.innerText = videoItem.title;
    titleSpan.style.cssText = 'font-weight:bold; display:block; margin-left:110px;';

    const channelSpan = document.createElement("span");
    channelSpan.innerText = videoItem.channelTitle;
    channelSpan.style.cssText = 'margin-left:10px; float:left;';

    const deleteButton = document.createElement("button");
    deleteButton.innerText = 'Delete';
    deleteButton.classList.add("material-symbols-outlined");
    deleteButton.style.cssText = 'float:right;';
    deleteButton.onclick = function() {
        li.remove();
        handleDeletePlaylist();
    };

    const durationSpan = document.createElement("span");
    durationSpan.innerText = videoItem.duration;
    durationSpan.style.cssText = 'display:block; margin-left:110px;';

    li.appendChild(img);
    li.appendChild(titleSpan);
    li.appendChild(durationSpan);
    li.appendChild(channelSpan);
    li.appendChild(deleteButton);

    return li
}

socket.on("updatePlaylist", (data) => {
    const playlistList = playlistForm.querySelector("ol");
    const sortableList = document.getElementById("sortableList");
    playlistList.remove();

    const newPlaylistList = document.createElement("ol");
    newPlaylistList.className = "list-group";
    newPlaylistList.id = "sortable-list";

    data.forEach(videoItem => {
        const videoListItem = createVideoListItem(videoItem);
        newPlaylistList.appendChild(videoListItem);
    });
    playlistForm.insertBefore(newPlaylistList, sortableList);
    
    handleSortablePlaylist();
    var sortable = new Sortable(document.getElementById('sortable-list'), {
        animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
        ghostClass: 'sortable-ghost' // Class name for the drop placeholder
    });
});