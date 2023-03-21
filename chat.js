class VideoInfo
{
    constructor(durationInSeconds, videoTitle, username, link)
    {
        this.username = username; // Who added this link.
        this.durationInSeconds = durationInSeconds;
        this.videoTitle = videoTitle;
        this.link = link;
    }
}

class Room
{
    constructor(id)
    {
        this.id = id;
        this.clients = new Set();
        this.queue = [];
        this.timer = 0;
        this.likeAmount = 0;
        this.dislikeAmount = 0;
        this.timerStarted = false;
    }
    addLikeType(likeType)
    {
        if (likeType) this.likeAmount++;
        else this.dislikeAmount++;
    }
    sendLikesUpdate() { return `Likes: ${this.likeAmount}<br>Dislikes: ${this.dislikeAmount}`; }
    startTimer() 
    {
        this.timerStarted = true;
        setInterval(() => 
        {
            if (this.queue.length > 0)
            {
                if (++this.timer >= this.queue[0].durationInSeconds)
                {
                    this.queue.shift();
                    this.timer = 0;
                    this.resetLikes();
                    console.log("Current queue:");
                    this.queue.forEach(videoInfo => console.log(videoInfo));
                    if (this.queue.length === 0) sendQueueUpdate(this.id, true);
                }
                console.log("Timer: " + this.timer + " Queue size: " + this.queue.length);
            }
        }, 1000); 
    }
    resetLikes()
    {
        this.likeAmount = 0;
        this.dislikeAmount = 0;
        let response =
        {
            type: "likeUpdate",
            roomId: this.id,
            update: this.sendLikesUpdate(),
            reset: true
        }
        rooms[this.id].clients.forEach(function each(client) 
        {
            if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(response));
        });
    }
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const port = 6800;
const server = http.createServer(express);
const wss = new WebSocket.Server({ server });

let rooms = {};
wss.on("connection", function connection(ws) 
{
    console.log("connected")
    // Object.keys(rooms).forEach(r => console.log(r))
    ws.on("message", function incoming(data) 
    {
        let contents = JSON.parse(data);
        console.log(contents.type)
        let roomId = contents.roomId;
        if (contents.type === "subscribe") // When client tries to create/join room.
        {
            console.log("subscribed")
            if (!rooms[roomId]) rooms[roomId] = new Room(roomId); // Create a new room with sent ID, if such room does not exist.
            rooms[roomId].clients.add(ws); // Add client to this room.
            let clientJoined =
            {
                type: "likeUpdate",
                roomId: roomId,
                update: rooms[roomId].sendLikesUpdate(),
                reset: false
            }
            ws.send(JSON.stringify(clientJoined));
        }
        else if (contents.type === "message") // When client sends message to chat.
        {
            console.log("message received" + contents.text + "room:" + contents.roomId)
            if (rooms[roomId])
            {
                console.log("praejo")
                let response = 
                {
                    type: "chat",
                    message: { username: contents.username, text: contents.text.toString() }
                }
                console.log(rooms[roomId].clients.length);
                rooms[roomId].clients.forEach(function each(client)
                {   
                    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(response));
                });
            }
        }
        else if (contents.type === "addToQueue") // When client wants to add youtube video link to queue.
        {
            if (rooms[roomId]) 
            {
                let queue = rooms[roomId].queue;
                if (queue.length > 0)
                {
                    if (queue.some(videoInfo => videoInfo.username === contents.username)) // If client already has added youtube link to queue, then return.
                    {
                        console.log("Client with this username already has added youtube link to queue.");
                        return;
                    }
                }
                if (queue.length === 0) sendQueueUpdate(roomId, false);
                rooms[roomId].queue.push(new VideoInfo(contents.duration, contents.title, contents.username, contents.link));
                if (!rooms[roomId].timerStarted) rooms[roomId].startTimer();
            }
        }
        else if (contents.type === "likeInput") // When client clicks like or dislike button.
        {
            if (rooms[roomId])
            {
                rooms[roomId].addLikeType(contents.likeType);
                let response =
                {
                    type: "likeUpdate",
                    roomId: roomId,
                    update: rooms[roomId].sendLikesUpdate(),
                    reset: false
                }
                rooms[roomId].clients.forEach(function each(client) 
                {
                    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(response));
                });
            }
        }
        else if (contents.type === "ban")
        {
            if (rooms[roomId])
            {
                let response =
                {
                    type: "disconnect",
                    roomId: roomId,
                    username: contents.text
                }
                rooms[roomId].clients.forEach(function each(client)
                {
                    if (client !== ws && client.readyState === WebSocket.OPEN) client.send(JSON.stringify(response));
                });
            }
        }
    });
    ws.on("close", function() 
    {
        let removedFromRoom = false;
        for (let roomId in rooms) 
        {
            if (rooms.hasOwnProperty(roomId) && rooms[roomId].clients.has(ws)) 
            {
                if (!removedFromRoom) removedFromRoom = true;
                rooms[roomId].clients.delete(ws);
            }
        }
    });
});

server.listen(port, function() 
{
    console.log(`Server is listening on ${port}!`)
})

function sendQueueUpdate(roomId, state)
{
    let response = 
    {
        type: "queueUpdate",
        roomId: roomId,
        isEmpty: state
    }
    rooms[roomId].clients.forEach(function each(client) 
    {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(response));
    });
}