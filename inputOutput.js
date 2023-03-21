const sendBtn = document.querySelector("#sendMessageButton");
const messages = document.querySelector("#messages");
const messageBox = document.querySelector("#messageBox");
const copyRoomId = document.querySelector("#roomIdButton");

let roomId;
let username;
let ws;

window.onload = function() 
{
    const roomInfo = sessionStorage.getItem("roomInfo");
    const contents = JSON.parse(roomInfo);
    roomId = contents.roomId;
    username = contents.username;
    init(roomInfo);
}

function showMessage(message) 
{
    messages.textContent += `\n\n${message}`;
    messages.scrollTop = messages.scrollHeight;
    messageBox.value = "";
}

sendBtn.onclick = function() 
{
    let type = "message";
    let text = messageBox.value;
    if (!ws) 
    {
        showMessage("No WebSocket connection.");
        return;
    }
    if (true) // If user is an admin.
    {
        if (text.startsWith("/ban")) 
        {
            type = "ban";
            text = text.substring(5);
        }
    }
    const response = 
    {
        type: type,
        username: username,
        roomId: roomId,
        text: text
    };
    ws.send(JSON.stringify(response));
    showMessage(username + ": " + messageBox.value);
}

copyRoomId.onclick = function()
{
    navigator.clipboard.writeText(roomId);
}

function init(roomInfo) 
{
    if (ws) 
    {
        ws.onerror = ws.onopen = ws.onclose = null;
        ws.close();
    }
    ws = new WebSocket('ws://localhost:6800');
    ws.onopen = function() { ws.send(roomInfo) };
    ws.onmessage = (event) => 
    {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') { showMessage(data.message); } // Update chat for client.
        else if (data.type === 'likeUpdate')
        {
            document.getElementById("allLikes").innerHTML = data.update; // Update likes for client.
            if (data.reset) switchLikeButtons(false);
        }
        else if (data.type === 'disconnect' && data.username === username) window.location.href = "../chat/createJoinRoom.html"; // Disconnect the client from the room.
        else if (data.type === 'queueUpdate') switchLikeButtons(data.isEmpty); // If queue is empty, disable like buttons.
    }
    ws.onclose = function() { ws = null; }
}

function joinQueue()
{
    isValidYouTubeLink(document.getElementById('link').value, "AIzaSyC7ELCsuy3A-MxAARMi2RN_667hdgcSti4")
    .then(response =>
    {
        if (response.valid) ws.send(JSON.stringify(response));
        else console.log("INVALID VIDEO LINK"); // If link is not valid.
    });
}

function getVideoId(link) 
{
    const match = link.match(/(?:v=)([^\&\?\/]+)/);
    if (match) return match[1];
    return null;
}

async function isValidYouTubeLink(link, apiKey) 
{
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${getVideoId(link)}&key=${apiKey}`);
    const data = await response.json();
    let result = { valid: false }
    if (data.items && data.items.length > 0) // Checks if it is valid youtube link.
    {
        const status = data.items[0].status;
        if (status.privacyStatus === "private" || status.uploadStatus === "deleted") return result; // Checks if youtube link still exists.
        else 
        {
            result.type = "addToQueue";
            result.roomId = roomId;
            result.valid = true;
            result.duration = parseToSeconds(data.items[0].contentDetails.duration);
            result.title = data.items[0].snippet.title;
            result.username = username;
            result.link = link;
            return result;
        }
    }
    return result;
}

function parseToSeconds(duration) 
{
    const matches = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = matches[1] ? parseInt(matches[1]) : 0;
    const minutes = matches[2] ? parseInt(matches[2]) : 0;
    const seconds = matches[3] ? parseInt(matches[3]) : 0;
    return hours * 3600 + minutes * 60 + seconds;
}

function isLike(likeType)
{
    let response =
    {
        type: "likeInput",
        roomId: roomId,
        likeType: likeType
    }
    switchLikeButtons(true);
    ws.send(JSON.stringify(response));
}

function switchLikeButtons(state)
{
    document.getElementById("likeButton").disabled = state;
    document.getElementById("dislikeButton").disabled = state;
}