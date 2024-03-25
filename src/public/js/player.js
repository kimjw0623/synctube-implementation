
let isStateChangeEvent = false;
let lastReportedTime = 0;
let currentTime = 0;
let isPlayerReady = false;
let isSyncTime = false;

let lastPlayerState = -1
const clientDelay = 0.5;
let allComments = [];
let commentIntervalId = null;

//const appPlayer = document.getElementById("videoUrl");
const playButton = appPlayer.querySelector("#playButton");
const addPlaylistButton = document.querySelector("#addButton");
const commentDiv = document.getElementById("comment");

playButton.addEventListener("click", handleVideoUrlSubmit);
addPlaylistButton.addEventListener("click", handlePlaylistSubmit);

function createElement(type, text, style, color=null) {
    const newElement = document.createElement(type);
    newElement.innerText = text;
    newElement.style.cssText = style;
    if (color) {
        newElement.style.color = color;
    }
    return newElement;
}


function onPlayerReady() {
    isPlayerReady = true;
}

function updatePlayerSize() {
    playerElement = document.querySelector('.col-lg-7');
    playerWidth = playerElement.offsetWidth;

    if (player && player.setSize) {
        player.setSize(playerWidth, (playerWidth * 9) / 16);
    }
}

function reportCurrentTime() {
    setInterval(() => {
        currentTime = player.getCurrentTime();
        if (isSyncTime) {
            if (Math.abs(currentTime - lastReportedTime) >= 1) {
                socket.emit("syncTime", roomName, currentTime);
                lastReportedTime = currentTime;
            }
        }
    }, 2000);
}

function shuffleComments() {
    if (commentIntervalId !== null) {
        clearInterval(commentIntervalId);
    }
    listComments(allComments.slice(0, 10));
    commentIntervalId = setInterval(() => {
        let shuffledArray = [];
        if (10 > allComments.length) {
            console.warn("Requested more elements than are available in the array.");
            shuffledArray = allComments.slice();
        }
        else {
            for (let i = allComments.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allComments[i], allComments[j]] = [allComments[j], allComments[i]];
            }
            shuffledArray = allComments.slice(0, 10); 
        }
        listComments(shuffledArray);
    }, 10000);
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
    console.log(`${event.data}`)
    if (isStateChangeEvent && event.data !== YT.PlayerState.BUFFERING) {  
        console.log(`Emit change!: ${event.data}`)
        socket.emit("stateChange", {
            room: roomName,
            playerState: event.data,
            currentTime: player.getCurrentTime(),
        });
    }
    lastPlayerState = event.data;
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
    videoComment.forEach(commentItem => {
        const comment = commentItem.snippet.topLevelComment.snippet.textDisplay;
        const author = commentItem.snippet.topLevelComment.snippet.authorDisplayName;
        const li = document.createElement("li");
        
        const commentUserSpan = createElement("span", author, "font-weight:bold; display:block; margin-left:10px;");
        const commentTextSpan = createElement("span", comment, "display:block; margin-left:10px;");
        
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
    const userColor = localStorage.getItem("chatColor");
    socket.emit("addVideo", {
        videoId: input.value,
        room: roomName,
        applicant: nickname,
        applicantColor: userColor,
    });
    console.log("add playlist! - submit");
    input.value = "";
}

function handleSwitchChatPlaylist() {
    const radios = document.querySelectorAll("label[name='radio']");
	radios.forEach((radio) => {
        radio.addEventListener("click", (e) => {
            const current = e.currentTarget;
            if (current.querySelector("input").id === "playlist") {
                document.getElementById("playlistForm").hidden = false;
                document.getElementById("room").hidden = true;
                localStorage.setItem("switchOption", "playlist");
            }
            else {
                document.getElementById("playlistForm").hidden = true;
                document.getElementById("room").hidden = false;
                const chatContainer = document.querySelector(".chat-messages");
                chatContainer.scrollTop = chatContainer.scrollHeight;
                localStorage.setItem("switchOption", "chat");
            }
		});
	});
};

function sendCurrentPlaylist(sortableList) {
    const playlist = [];
    sortableList.querySelectorAll("li").forEach((videoBlock) => {
        const videoMetadata = JSON.parse(videoBlock.querySelector("div").textContent);
        playlist.push(videoMetadata);
    })
    socket.emit("changePlaylist", playlist, roomName);
}

function handleSortablePlaylist() {
    const sortableList = document.getElementById("sortable-list");
    sortableList.addEventListener("drop", (e) => {
        sendCurrentPlaylist(sortableList);
	});
};

function handleDirectPlaylist(videoId) {
    const sortableList = document.getElementById("sortable-list");
    socket.emit("videoUrlChange", {
        videoId: videoId,
        room: roomName
    });
    sendCurrentPlaylist(sortableList);
}

socket.on("videoUrlChange", (data, videoComment) => {
    blockStateChange(function () {
        currentTime = 0;
        allComments = videoComment.items;
        shuffleComments();
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
                allComments = videoComment.items;
                shuffleComments();
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
            isSyncTime = true;
            reportCurrentTime();
            setVideoTitle(data);
            // Load choice
            const optionValue = localStorage.getItem("switchOption");
            if (optionValue) {
                const radioOptions = document.querySelectorAll("label[name='radio']");
                for (const option of radioOptions) {
                    if (option.value === optionValue) {
                        option.checked = true;
                        break;
                    }
                }
                if (optionValue === "playlist") {
                    document.getElementById("playlistForm").hidden = false;
                    document.getElementById("room").hidden = true;
                }
                else {
                    document.getElementById("playlistForm").hidden = true;
                    document.getElementById("room").hidden = false;
                    const chatContainer = document.querySelector(".chat-messages");
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
            console.log("init done!");
        }
    }, 100);
});

socket.on("stateChange", data => {
    const serverTime = data.currentTime;
    const serverStatus = data.playerState;
    console.log("get stateChange!", serverStatus);
    blockStateChange(function () {
        if (Math.abs(serverTime - player.getCurrentTime()) > clientDelay) {
            player.seekTo(serverTime, true);
        }
        if (serverStatus === YT.PlayerState.PLAYING) {
            player.playVideo();
        }
        else if (serverStatus === YT.PlayerState.PAUSED) {
            player.pauseVideo();
        }
    },10);
});

socket.on("SyncTime", data => {
    const serverTime = data.currentTime;
    const serverStatus = data.playerState;
    console.log(`get ${serverTime}`);
    blockStateChange(function () {
        if (Math.abs(serverTime - player.getCurrentTime()) > 0.25) {
            player.seekTo(serverTime, true);
        }
        // if (serverStatus === YT.PlayerState.PLAYING) {
        //     player.playVideo();
        // }
        // else if (serverStatus === YT.PlayerState.PAUSED) {
        //     player.pauseVideo();
        // }
    },10);
});

function createVideoListItem(videoItem) {
    const li = document.createElement("li");
    li.className = "list-group-item";
    
    const img = document.createElement("img");
    img.src = videoItem.thumbnailUrl;
    img.alt = videoItem.id;
    img.style.cssText = 'width:100px; height:auto; float:left;';

    const videoMetadataSpan = document.createElement("div");
    videoMetadataSpan.hidden = true;
    videoMetadataSpan.textContent = JSON.stringify(videoItem);
    const titleSpan = createElement("span", videoItem.title, "font-weight:bold; display:block; margin-left:110px;");
    const channelSpan = createElement("span", videoItem.channelTitle, "margin-left:10px;");
    const durationSpan = createElement("span", videoItem.duration, "display:block; margin-left:110px;");
    const applicantSpan = createElement("span", `Requested by: ${videoItem.applicant}`, "display:block; margin-left:110px;", videoItem.applicantColor);
    const deleteButton = createElement("button", "Delete", "float:right;");
    deleteButton.classList.add("material-symbols-outlined");
    deleteButton.onclick = function() {
        li.remove();
        sendCurrentPlaylist(sortableList);
    };
    const playButton = createElement("button", "arrow_right", "float:right;");
    playButton.classList.add("material-symbols-outlined");
    playButton.onclick = function () {
        li.remove();
        handleDirectPlaylist(img.alt);
    };

    li.appendChild(img);
    li.appendChild(videoMetadataSpan);
    li.appendChild(titleSpan);
    li.appendChild(durationSpan);
    li.appendChild(channelSpan);
    li.appendChild(applicantSpan);
    li.appendChild(deleteButton);
    li.appendChild(playButton)

    return li;
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
    var sortable = new Sortable(document.getElementById('sortable-list'), {
        animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
        ghostClass: 'sortable-ghost' // Class name for the drop placeholder
    });
    handleSortablePlaylist();
    
});