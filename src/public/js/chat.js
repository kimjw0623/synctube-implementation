
class ChatClient {
    constructor(socket) {
        this.socket = socket;
        this.chatContainer = document.getElementById("room");
        this.chatForm = document.getElementById("chatForm");
        this.changeIdForm = document.getElementById("changeId");
        // Method binding
        this.handleMessageSubmit = this.handleMessageSubmit.bind(this);
        this.handleChangeIdSubmit = this.handleChangeIdSubmit.bind(this);
        this.setupEventListeners();
        console.log(this.socket);
    }

    setupUI() {
        this.chatContainer.hidden = true;
    }

    setupEventListeners() {
        console.log("1q23a")
        this.socket.on("updateUserList", (users, user) => {
            const h3 = room.querySelector("h3");
            loadUserList(users);
            //addMessage(`${user} Bye!`);
        });

        this.socket.on("newMessage", (messageData, newCount) => {
            this.addMessage(messageData);
        });

        this.chatForm.addEventListener("submit", this.handleMessageSubmit);
        this.changeIdForm.addEventListener("submit", this.handleChangeIdSubmit);
    }

    addMessage(msg) {
        const ul = this.chatContainer.querySelector("ul");
        const li = document.createElement("li");

        if (msg.nickname === nickname) {
            msg.nickname = "You";
        }

        const firstWordElement = createElement(
            "span",
            msg.nickname + ": ",
            "",
            msg.color
        );

        li.appendChild(firstWordElement);
        li.appendChild(document.createTextNode(msg.content));
        ul.appendChild(li);
        // Scroll to last chat msg
        li.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    loadMessage(msgs) {
        const ul = this.chatContainer.querySelector("ul");
        ul.innerHTML = ""; // Delete all elements in ul (delete old msg)
        msgs.forEach(msg => {
            const li = document.createElement("li");
            if (msg.nickname === nickname) {
                msg.nickname = "You";
            }
            const firstWordElement = document.createElement("span");
            firstWordElement.style.color = msg.color;
            firstWordElement.textContent = msg.nickname + ": ";

            li.appendChild(firstWordElement);
            li.appendChild(document.createTextNode(msg.content));
            ul.appendChild(li);
        });
    }

    handleMessageSubmit(event) {
        event.preventDefault();
        const chatForm = document.getElementById("chatForm");
        const input = chatForm.querySelector("input");
        const value = input.value
        const chatColor = localStorage.getItem("chatColor");
        this.socket.emit("newMessage", input.value, roomName, chatColor, () => {
            const messageData = {
                "nickname": nickname,
                "content": value,
                "color": chatColor
            }
            this.addMessage(messageData);
        });
        input.value = ""
    }

    handleChangeIdSubmit(event) {
        console.log(this.socket);
        event.preventDefault();
        const changeIdForm = document.getElementById("changeId");
        const input = changeIdForm.querySelector("input");
        this.socket.emit("changeUserId", input.value, nickname);
        nickname = input.value;
        input.value = "";
    }
}
