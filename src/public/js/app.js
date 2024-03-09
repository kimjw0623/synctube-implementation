let token = localStorage.getItem('token');
let query = token ? { query: `token=${token}` } : {};
let isPlayerReady = false
let socket = io.connect('http://localhost:3000', query);

socket.on('token', (token) => {
    localStorage.setItem('token', token);
    console.log('Toekn saved: ', token);
});


const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const chatForm = document.getElementById("chatForm");


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
    console.log(socket);
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

socket.on("enter_room_wtoken", (room) => {
    console.log("reconnected");
    roomName = room;
    socket.emit("enter_room", room, showRoom);
    socket.emit("initState", socket.id);
});

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

socket.on("new_message", (a, newCount) => {
    console.log(a);
    addMessage(a)
});

socket.on("room_change", (rooms) => {
    // if(rooms.length === 0){
    //     roomList.innerHTML = "";
    //     return;
    // }
    if (localStorage.getItem("token") === null) {
        return
    }
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const roomListSpan = document.createElement("span");
        roomListSpan.innerText = room;
        roomListSpan.style.cssText = 'font-weight:bold; display:block;';
        roomList.appendChild(roomListSpan);
    })
});

// --------------------------------------- //

const appPlayer = document.getElementById("videoUrl");
const playButton = appPlayer.querySelector("#playButton");
const addPlaylistButton = document.querySelector("#addButton");
const commentDiv = document.getElementById("comment");
const playlistChat = document.getElementById("playlistChat");
const homeButton = document.getElementById("home");

let lastPlayerState = -1;
let isStateChangeEvent = false;
let lastReportedTime = 0;
let currentTime = 0;
document.getElementById("main").style.display = "none";
appPlayer.style.display = "none";
playlistChat.style.display = "none";

room.hidden = true;
let roomName = 1;


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

function onPlayerReady() {
    isPlayerReady = true;
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
    console.log(`comment: ${videoComment}`);
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
    const videoTitle = document.getElementById("videoTitle");
    const videoSpan = videoTitle.querySelectorAll("span");
    videoSpan.forEach(span => {
        span.remove()
    });
    const videoTitleSpan = document.createElement("span");
    videoTitleSpan.innerText = data.currentVideo.title;
    videoTitleSpan.style.cssText = 'font-weight:bold; display:block; margin-left:10px; font-size: 20px';
    const videoChannelSpan = document.createElement("span");
    videoChannelSpan.innerText = data.currentVideo.channelTitle;
    videoChannelSpan.style.cssText = 'display:block; margin-left:10px; font-size: 12px';
    
    videoTitle.appendChild(videoTitleSpan);
    videoTitle.appendChild(videoChannelSpan);

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
        console.log(`Current playlist: ${idList}`);
        socket.emit("changePlaylist", idList, roomName);
	});
};

function handleDeletePlaylist() {
    let idList = [];
    const sortableList = document.getElementById("sortable-list");
    sortableList.querySelectorAll("li").forEach((id) => {
        idList.push(id.querySelector("img").alt);
    })
    console.log(idList);
    socket.emit("changePlaylist", idList, roomName);
}

function handleHomeSubmit() {
    // 1. initialize token in localStorage
    // 2. hide/reveal objects
    localStorage.removeItem("token");
    room.hidden = true;
    document.getElementById("main").style.display = "none";
    appPlayer.style.display = "none";
    playlistChat.style.display = "none";
    document.getElementById("welcome").hidden = false;
}

playButton.addEventListener("click", handleVideoUrlSubmit);
addPlaylistButton.addEventListener("click", handlePlaylistSubmit);
homeButton.addEventListener("click", handleHomeSubmit);

socket.on("videoUrlChange", (data, videoComment) => {
    //console.log("get Urlchange!")
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
                }, 100);
                setVideoTitle(data);
                console.log(data.playerTime);
                
            });
            document.getElementById("main").style.display = "";
            appPlayer.style.display = "";
            playlistChat.style.display = "";
            reportCurrentTime();
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

socket.on("updatePlaylist", (data) => {
    const playlistList = playlistForm.querySelector("ol");
    const sortableList = document.getElementById("sortableList");
    playlistList.remove();
    const newPlaylistList = document.createElement("ol");
    newPlaylistList.className = "list-group";
    newPlaylistList.id = "sortable-list";
    playlistForm.insertBefore(newPlaylistList,sortableList);
    data.forEach(videoItem => {
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
        
        newPlaylistList.appendChild(li);
    });
    handleSortablePlaylist();
    // important!!! eventlist has gone
    var sortable = new Sortable(document.getElementById('sortable-list'), {
        animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
        ghostClass: 'sortable-ghost' // Class name for the drop placeholder
    });
});