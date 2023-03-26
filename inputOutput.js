const sendBtn = document.querySelector("#sendMessageButton");
const messages = document.querySelector("#messages");
const messageBox = document.querySelector("#messageBox");
const copyRoomId = document.querySelector("#roomIdButton");

let roomId;
let username;
let userId;
let alreadySentLike = false;
let ws;
let queue = [];

window.onload = function() 
{
    const roomInfo = sessionStorage.getItem("roomInfo");
    const contents = JSON.parse(roomInfo);
    roomId = contents.roomId;
    username = contents.username;
    userId = generateRandomUserId(); // Pakolkas taip tik sugeneruoju random id.
    init(roomInfo);
}

function showMessage(message) 
{
    messages.textContent += `\n\n${message.username + ": " + message.text}`;
    messages.scrollTop = messages.scrollHeight;
    messageBox.value = "";
}

sendBtn.onclick = function() 
{
    let type = "message";
    let text = messageBox.value;
    if (text.trim().length === 0) return; // If message is empty do not send it.
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
        else if (text.startsWith("/skip")) type = "skip";
    }
    const response = 
    {
        type: type,
        username: username,
        roomId: roomId,
        text: text
    };
    ws.send(JSON.stringify(response));
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
        else if (data.type === "clientJoined") // RENALDAS: Cia gauna likes/dislikes, dabartines dainos jau kiek sekundziu praejo ir queue masyva bei dabartine daina galima pasiekti queue[0].kaReikiaIsDainos.
        {
            document.getElementById("allLikes").innerHTML = "Likes: " + data.update.likes + " Dislikes: " + data.update.dislikes; // Update likes for client.
            queue = data.queue;
            if (queue.length !== 0) 
            {
                switchLikeButtons(false); // If queue has songs then like buttons are working.
                printCurrentSong(); // RENALDAS: isspausdina dabartines grojancios dainos duomenys.
                console.log("\nHow much song passed in seconds: " + data.timer);
            }
            else switchLikeButtons(true); // If queue do not have songs then like buttons are disabled.
        }
        else if (data.type === 'likeUpdate')
        {
            document.getElementById("allLikes").innerHTML = "Likes: " + data.update.likes + " Dislikes: " + data.update.dislikes; // Update likes for client.
            if (data.reset) switchLikeButtons(false); // If new song started playing, reset like buttons.
        }
        else if (data.type === 'banned' && data.username === username) // RENALDAS: userId negalejau padaryt cia, nes funkcija /ban [username] rasosi
        {
            console.log("You have been banned");
            window.location.href = "../chat/createJoinRoom.html"; // Disconnect the client from the room.
        }
        else if (data.type === 'skipped' && data.userId === userId) console.log("Your song has been skipped"); // RENALDAS: kai zmogaus daina buna praskipinta.
        else if (data.type === 'tookOutSong' && data.userId === userId) console.log("Song has been successfully taken out");
        else if (data.type === 'queueUpdate') 
        {
            queue = data.queue;
            printCurrentSong(); // RENALDAS: isspausdina dabartines grojancios dainos duomenys.
            if (data.isUpdateForButtons) 
            {
                alreadySentLike = false;
                switchLikeButtons(data.isEmpty); // If queue is empty, disable like buttons.
            }
        }
    }
    ws.onclose = function() { ws = null; }
}

function printCurrentSong() 
{
    if (queue.length !== 0) console.log("Who put this song by username: " + queue[0].username + "\nWho put this song by id: " + queue[0].userId + "\n\nSong duration: " + queue[0].songDuration + "\nVideo title: " + queue[0].videoTitle + "\nYt link: " + queue[0].link);
    else console.log("Queue is empty");
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
            result.username = username;
            result.duration = parseToSeconds(data.items[0].contentDetails.duration);
            result.title = data.items[0].snippet.title;
            result.userId = userId;
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
        likeType: likeType,
        sentMoreThanOnce: alreadySentLike
    }
    ws.send(JSON.stringify(response));
    let disabledButtonId = likeType ? "likeButton" : "dislikeButton";
    let enabledButtonId = likeType ? "dislikeButton" : "likeButton";
    onClickChangeLikeButtons(disabledButtonId, enabledButtonId);
    alreadySentLike = true;
}

function onClickChangeLikeButtons(buttonIdDisabled, buttonIdEnabled)
{ 
    document.getElementById(buttonIdDisabled).disabled = true; 
    document.getElementById(buttonIdEnabled).disabled = false; 
}

function switchLikeButtons(state)
{
    document.getElementById("likeButton").disabled = state;
    document.getElementById("dislikeButton").disabled = state;
}

function takeSongOut()
{
    let response =
    {
        type: "takeOutSong",
        roomId: roomId,
        userId: userId
    }
    ws.send(JSON.stringify(response));
}

function generateRandomUserId()
{
    const possibleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:',.<>/?`~";
    let id = "";
    for (let i = 0; i < 100; i++) id += possibleChars[Math.floor(Math.random() * possibleChars.length)];
    return id;
}