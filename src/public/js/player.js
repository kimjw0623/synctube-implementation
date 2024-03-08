let tag = document.createElement("script");

tag.src = "https://www.youtube.com/iframe_api/";
let firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
let player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: "450",
        width: "750",
        videoId: "M7lc1UVf-VE",
        events: {
            "onReady": onPlayerReady,
            "onStateChange": onPlayerStateChange
        }
    });
}