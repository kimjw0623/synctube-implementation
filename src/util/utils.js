import mongoose from "mongoose";

mongoose.connect('mongodb://localhost:27017/videos', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connect.'))
    .catch(err => console.error('MongoDB failed.', err));
    
const Schema = mongoose.Schema;
const videoSchema = new Schema({
    videoId: { type: String, required: true, unique: true },
    comment: { type: "Mixed", default: {} },
    metadata: { type: "Mixed", default: {} },
});
const chatSchema = new Schema({
    roomName: { type: String, required: true, unique: true },
    chats: { type: "Mixed", default: [] },
});
const userSchema = new Schema({
    token : { type: String, required: true, unique: true },
    userName: { type: "String", default: "default" },
});
const videoDB = mongoose.model('Video', videoSchema);


export function timeStringToSeconds(timeString) {
    var timePattern = /^(\d+):?(\d+)?:?(\d+)?$/;
    var match = timePattern.exec(timeString);

    var hours = parseInt(match[1]) || 0;
    var minutes = parseInt(match[2]) || 0;
    var seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
}


export function parseISODuration(duration, onlySecond = true) {
    const regex = /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    const hours = parseInt(matches[4]) || 0;
    const minutes = parseInt(matches[5]) || 0;
    const seconds = parseInt(matches[6]) || 0;

    if (onlySecond) {
        return (hours * 60 + minutes) * 60 + seconds;
    }
    else {
        if (hours === 0) {
            return `${minutes}:${seconds}`;
        }
        else if (minutes === 0) {
            return `${seconds}`;
        }
        else {
            return `${hours}:${minutes}:${seconds}`;
        }
    }
}

async function listComments(videoId) {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?key=${apiKey}&textFormat=plainText&part=snippet&videoId=${videoId}&maxResults=10`;
    let commentList
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        commentList = Object.assign({}, data);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }

    return commentList
}


async function getVideoMetadata(videoId) {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=contentDetails,snippet`;
    let videoMetadata;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        videoMetadata = Object.assign({}, data);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }

    return videoMetadata
}
export async function insertVideoDB(videoId) {
    const comment = await listComments(videoId);
    const metadata = await getVideoMetadata(videoId);
    // check whether videoId exists
    const res = await videoDB.find({ videoId: videoId }).exec();
    if (res.length === 0) {
        await videoDB.create({
            videoId: videoId,
            comment: comment,
            metadata: metadata,
        });
    }
}

export async function readVideoDB(videoId) {
    const videoInfo = await videoDB.find({ videoId: videoId }).exec();
    if (videoInfo.length != 0) {
        const comment = videoInfo[0].comment;
        const metadata = videoInfo[0].metadata;
        return { comment: comment, metadata: metadata }
    }
    else {
        return { comment: undefined, metadata: undefined }
    }
}
