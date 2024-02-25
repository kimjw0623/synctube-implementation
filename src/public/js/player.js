var tag = document.createElement("script");

tag.src = "https://www.youtube.com/iframe_api/?rand=" + Math.round(Math.random() * 10000000);
var firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
var player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: "360",
        width: "640",
        videoId: "M7lc1UVf-VE",
        events: {
            "onStateChange": onPlayerStateChange
        }
    });
}