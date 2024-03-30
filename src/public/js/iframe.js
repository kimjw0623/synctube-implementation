
let tag = document.createElement("script");

tag.src = "https://www.youtube.com/iframe_api/";
let firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let playerElement = document.querySelector('.col-lg-7');
let playerWidth = playerElement.offsetWidth;
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: (playerWidth * 9) / 16,
        width: playerWidth,
        videoId: "M7lc1UVf-VE",
        events: {
            "onReady": onPlayerReady,
            "onStateChange": onPlayerStateChange
        }
    });
}

window.addEventListener('resize', function() {
    videoPlayer.updatePlayerSize();
});