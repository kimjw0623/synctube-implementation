class VideoPlayer{
    constructor(socket, roomName) {
        this.socket = socket;
        this.roomName = roomName;
        this.playlistForm = document.getElementById("playlistForm");
        this.isPlayerReady = false;
        this.lastReportedTime = 0;
        this.isSyncTime = false;
        this.commentIntervalId = null;
        this.syncIntervalId = null;
        this.allComments = [];
        this.appPlayer = document.getElementById("videoUrl");
        this.playButton = appPlayer.querySelector("#playButton");
        this.addPlaylistButton = document.querySelector("#addButton");
        this.commentDiv = document.getElementById("comment");

        this.handleVideoUrlSubmit = this.handleVideoUrlSubmit.bind(this);
        this.handlePlaylistSubmit = this.handlePlaylistSubmit.bind(this);
        this.handleDirectPlaylist = this.handleDirectPlaylist.bind(this);
        this.sendCurrentPlaylist = this.sendCurrentPlaylist.bind(this);
        this.shuffleComments = this.shuffleComments.bind(this);
        this.playButton.addEventListener("click", this.handleVideoUrlSubmit);
        this.addPlaylistButton.addEventListener("click", this.handlePlaylistSubmit);
        console.log("videoplayer init!");
    }

    updatePlayerSize() {
        const playerElement = document.querySelector('.col-lg-7');
        const playerWidth = playerElement.offsetWidth;

        if (player && player.setSize) {
            player.setSize(playerWidth, (playerWidth * 9) / 16);
        }
    }

    shuffleComments() {
        console.log("assda")
        clearInterval(this.commentIntervalId);
        this.listComments(this.allComments.slice(0, 10)); // 초기 댓글 목록 표시

        this.commentIntervalId = setInterval(() => {
            let shuffledArray = [];
            if (this.allComments.length <= 10) {
                console.warn("Requested more elements than are available.");
                shuffledArray = [...this.allComments];
            } else {
                this.shuffleArray(this.allComments);
                shuffledArray = this.allComments.slice(0, 10);
            }
            this.listComments(shuffledArray);
        }, 10000);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    listComments(videoComments) {
        //const commentDiv = document.querySelector('.comment-section');
        const commentsUl = this.commentDiv.querySelector("ul");
        commentsUl.innerHTML = '';
        videoComments.forEach(commentItem => {
            const comment = commentItem.snippet.topLevelComment.snippet.textDisplay;
            const author = commentItem.snippet.topLevelComment.snippet.authorDisplayName;
            const li = document.createElement("li");
            
            const commentUserSpan = createElement("span", author, "font-weight:bold; display:block; margin-left: 10px");
            const commentTextSpan = createElement("span", comment, "display:block; margin-left: 10px");
            
            li.appendChild(commentUserSpan);
            li.appendChild(commentTextSpan);
            commentsUl.appendChild(li);
        });
    }

    setVideoTitle(data) {
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
    
    handlePlaylistSubmit(event) {
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
    
    handleSwitchChatPlaylist() {
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
    
    sendCurrentPlaylist(sortableList) {
        const playlist = [];
        sortableList.querySelectorAll("li").forEach((videoBlock) => {
            const videoMetadata = JSON.parse(videoBlock.querySelector("div").textContent);
            playlist.push(videoMetadata);
        })
        socket.emit("changePlaylist", playlist, roomName);
    }
    
    handleSortablePlaylist() {
        const sortableList = document.getElementById("sortable-list");
        sortableList.addEventListener("drop", (e) => {
            this.sendCurrentPlaylist(sortableList);
        });
    };
    
    handleDirectPlaylist(videoId) {
        const sortableList = document.getElementById("sortable-list");
        socket.emit("videoUrlChange", {
            videoId: videoId,
            room: roomName
        });
        this.sendCurrentPlaylist(sortableList);
    }
    
    handleVideoUrlSubmit(event){
        event.preventDefault();
        const input = appPlayer.querySelector("#playNow");
        socket.emit("videoUrlChange", {
            videoId: input.value,
            room: roomName
        });
        console.log("video changed! - submit");
        input.value = "";
    }

    createVideoListItem(videoItem) {
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
        deleteButton.onclick = function () {
            const sortableList = document.getElementById("sortable-list");
            li.remove();
            this.sendCurrentPlaylist(sortableList);
        }.bind(this);
        const playButton = createElement("button", "arrow_right", "float:right;");
        playButton.classList.add("material-symbols-outlined");
        playButton.onclick = function () {
            li.remove();
            this.handleDirectPlaylist(img.alt);
        }.bind(this);
    
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

}