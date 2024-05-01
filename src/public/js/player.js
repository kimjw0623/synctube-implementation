
let isStateChangeEvent = false;
let currentTime = 0;
let isPlayerReady = false;
let isSyncTime = false;

let lastPlayerState = -1
const clientDelay = 0.5;
let allComments = [];
let commentIntervalId = null;

function initPlayerSocketListener(socket, videoPlayer) {
    socket.on("videoUrlChange", (data, videoComment) => {
        blockStateChange(function () {
            currentTime = 0;
            videoPlayer.allComments = videoComment.items;
            videoPlayer.shuffleComments();
            videoPlayer.setVideoTitle(data);
            player.loadVideoById(mediaContentUrl = String(data.currentVideo.id));
            player.seekTo(0, true);
            player.playVideo();
        });
    });

    // MARK: Initstate
    socket.on("initState", (data, videoComment) => {
        // initialize player state with server data
        const offset = 0.3;
        let loadStartTime = performance.now();
        const waitForPlayerReady = setInterval(() => {
            if (isPlayerReady) {
                let loadTimeInterval = performance.now() - loadStartTime;
                console.log(loadTimeInterval);
                player.loadVideoById(mediaContentUrl = data.currentVideo.id, data.playerTime+loadTimeInterval*0.001+offset);
                isStateChangeEvent = false;
                setTimeout(function () {
                    if (data.playerState === YT.PlayerState.PLAYING) {
                        player.playVideo();
                    } else if (data.playerState === YT.PlayerState.PAUSED) {
                        player.pauseVideo();
                    }
                }, 50);
                lastReportedTime = data.playerTime + loadTimeInterval * 0.001 + offset;
                
                videoPlayer.allComments = videoComment.items;
                videoPlayer.shuffleComments();
                
                document.getElementById("main").style.display = "";
                appPlayer.style.display = "";
                playlistChat.style.display = "";
                
                
                // videoPlayer.isSyncTime = true;
                reportCurrentTime();
                videoPlayer.setVideoTitle(data);
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
                client.loadMessage(messages);
                console.log("init done!");

                setTimeout(function () { isStateChangeEvent = true; }, 1000);
                clearInterval(waitForPlayerReady);
            }
        }, 100);
    });

    // MARK: StateChange
    socket.on("stateChange", data => {
        const serverTime = data.playerTime;
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
        }, 200);
    });

    // MARK: Synctime
    socket.on("SyncTime", data => {
        const serverTime = data.playerTime;
        const serverStatus = data.playerState;
        console.log(`Synctime: get ${serverTime}`);
        if (isPlayerReady) {
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
            }, 100);
        }
    });

    socket.on("updatePlaylist", (data) => {
        const playlistList = videoPlayer.playlistForm.querySelector("ol");
        const sortableList = document.getElementById("sortableList");
        playlistList.remove();

        const newPlaylistList = document.createElement("ol");
        newPlaylistList.className = "list-group";
        newPlaylistList.id = "sortable-list";

        data.forEach(videoItem => {
            const videoListItem = videoPlayer.createVideoListItem(videoItem);
            newPlaylistList.appendChild(videoListItem);
        });
        videoPlayer.playlistForm.insertBefore(newPlaylistList, sortableList);
        var sortable = new Sortable(document.getElementById('sortable-list'), {
            animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
            ghostClass: 'sortable-ghost' // Class name for the drop placeholder
        });
        videoPlayer.handleSortablePlaylist();

    });
}

function createElement(type, text, style, color = null) {
    const newElement = document.createElement(type);
    newElement.innerText = text;
    newElement.style.cssText = style;
    if (color) {
        newElement.style.color = color;
    }
    return newElement;
}

function onPlayerStateChange(event) {
    if (isStateChangeEvent && event.data !== YT.PlayerState.BUFFERING) {
            console.log(`${event.data}`);
            console.log(`Emit change!: ${event.data}`);
            videoPlayer.socket.emit("stateChange", {
                room: videoPlayer.roomName,
                playerState: event.data,
                playerTime: player.getCurrentTime(),
            });
    }
}

function onPlayerReady() {
    isPlayerReady = true;
}
