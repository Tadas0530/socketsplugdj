class VideoInfo {
  constructor(songDuration, videoTitle, userId, username, link, ws) {
    this.userId = userId;
    this.username = username;
    this.songDuration = songDuration;
    this.videoTitle = videoTitle;
    this.link = link;
    this.ws = ws;
  }
}

class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Set();
    this.queue = [];
    this.likeAmount = 0;
    this.dislikeAmount = 0;
    this.songStartTime = null;
    this.votedUsers = new Set();
    this.timeoutId = null;
    this.isPlaying = false;
  }
  // ... other methods

  // New method to get the elapsed time of the current song
  getElapsedTime() {
    if (!this.songStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - this.songStartTime) / 1000);
  }
  startNextSong() {
    setTimeout(() => {
      console.log("starting new song...");
      this.songStartTime = Date.now();
      this.scheduleNextSong();
      onSongStart(this.id);
    }, 1000);
  }

  scheduleNextSong() {
    if (this.queue.length > 0) {
      const currentSongDuration = this.queue[0].songDuration * 1000;
      const timeRemaining = currentSongDuration - this.getElapsedTime();

      this.timeoutId = setTimeout(() => {
        if (this.queue.length > 0) {
          onSongEnd(this.id);
          const finishedUserId = this.queue[0].userId;
          this.removeSong();
          console.log("Current queue:");
          this.queue.forEach((videoInfo) => console.log(videoInfo));

          if (this.queue.length === 0) {
            sendQueueUpdate(this.id, true, true, finishedUserId);
          } else {
            sendQueueUpdate(this.id, false, true, finishedUserId);
            console.log("sendQueueUpdate on line 50");
            this.startNextSong();
          }
        }
      }, timeRemaining);
    }
  }

  addLikeType(likeType, userId) {
    // Check if the user has already voted
    if (this.votedUsers.has(userId)) {
      return;
    }

    this.votedUsers.add(userId);
    if (likeType) this.likeAmount++;
    else this.dislikeAmount++;
  }
  subtractLikeType(likeType, userId) {
    // Check if the user has already voted
    if (!this.votedUsers.has(userId)) {
      return;
    }

    this.votedUsers.delete(userId);
    if (likeType) this.likeAmount--;
    else this.dislikeAmount--;
  }
  sendLikesUpdate() {
    return {
      likeAmount: this.likeAmount,
      dislikeAmount: this.dislikeAmount,
      votedUsers: Array.from(this.votedUsers),
    };
  }
  resetLikes() {
    this.likeAmount = 0;
    this.dislikeAmount = 0;
    this.votedUsers.clear();
    let response = {
      type: "likeUpdate",
      roomId: this.id,
      update: this.sendLikesUpdate(),
      reset: true,
    };
    rooms[this.id].clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN)
        client.send(JSON.stringify(response));
    });
  }
  removeSong(resetElapsedTime = false) {
    console.log("REMOVED SONG");
    if (this.queue.length > 0) {
      this.queue.shift();
    }

    // Reset songStartTime when the queue becomes empty or when resetElapsedTime is true
    if (this.queue.length === 0 || resetElapsedTime) {
      this.songStartTime = null;
    }
  }
  removeSongByUserId(userId) {
    if (this.queue.length > 0) {
      let index = this.queue.findIndex(
        (videoInfo) => videoInfo.userId === userId
      );
      if (index > 0) this.queue.splice(index, 1);
      else return "FAIL";
    } else return "FAIL";
  }
}

const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const port = 6800;
const server = http.createServer(express);
const wss = new WebSocket.Server({ server });

let rooms = {};
wss.on("connection", function connection(ws) {
  ws.userId = null;
  ws.on("message", function incoming(data) {
    let contents = JSON.parse(data);
    let roomId = contents.roomId;
    if (contents.type === "subscribe") {
      ws.userId = contents.userId;
      // When client tries to create/join room.
      if (!rooms[roomId]) rooms[roomId] = new Room(roomId); // Create a new room with sent ID, if such room does not exist.
      rooms[roomId].clients.add(ws); // Add client to this room.

      let clientJoined = {
        type: "clientJoined",
        roomId: roomId,
        update: rooms[roomId].sendLikesUpdate(),
        queue: rooms[roomId].queue,
        isPlaying: rooms[roomId].isPlaying,
        elapsedTime: rooms[roomId].getElapsedTime(),
        clients: rooms[roomId].clients,
        clientsCount: rooms[roomId].clients.size, // New clientsCount property
      };

      ws.send(JSON.stringify(clientJoined));
      // TADAS: update client count for already joined users
      let clientCount = {
        type: "clientSizeUpdate",
        clientsCount: rooms[roomId].clients.size,
        clients: rooms[roomId].clients
      };
      rooms[roomId].clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN)
          client.send(JSON.stringify(clientCount));
      });
    } else if (contents.type === "message") {
      // When client sends message to chat.
      if (rooms[roomId]) {
        console.log(contents.username + ": " + contents.text.toString());
        let response = {
          type: "chat",
          message: { username: contents.username, text: contents.text },
        };
        console.log(response);
        rooms[roomId].clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify(response));
        });
      }
    } else if (contents.type === "addToQueue") {
      // When client wants to add youtube video link to queue.
      /*
                1. Reikia tikrinti userId vietoj username
            */
      console.log("addToQueue fired");
      if (rooms[roomId]) {
        let queue = rooms[roomId].queue;
        if (queue.length > 0) {
          // ... other code ...
        }

        // Check if the user has already added a song to the queue
        const userHasSongInQueue = queue.some(
          (videoInfo) => videoInfo.userId === contents.userId
        );

        // If the user has a song in the queue, return and do not add another song
        if (userHasSongInQueue) {
          console.log("User has already added a song to the queue");
          return;
        }

        rooms[roomId].queue.push(
          new VideoInfo(
            contents.duration,
            contents.title,
            contents.userId,
            contents.username,
            contents.link,
            ws // Add this line to pass the WebSocket to the VideoInfo constructor
          )
        );

        if (rooms[roomId].queue.length === 1) {
          sendQueueUpdate(roomId, contents.userId, false, true);
          rooms[roomId].startNextSong(); // Start the song if it's the first song in the queue
        } else {
          sendQueueUpdate(roomId, contents.userId, null, true);
        }
      }
    } else if (contents.type === "likeInput") {
      // When client clicks like or dislike button.
      if (rooms[roomId]) {
        if (contents.sentMoreThanOnce)
          rooms[roomId].subtractLikeType(contents.likeType, contents.userId);
        rooms[roomId].addLikeType(contents.likeType, contents.userId);
        let response = {
          type: "likeUpdate",
          roomId: roomId,
          update: rooms[roomId].sendLikesUpdate(),
          reset: false,
        };
        rooms[roomId].clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify(response));
        });
      }
    } else if (contents.type === "ban") {
      /*
                1. Jeigu banas ar skipas pavyko atsiusti praskipintam ar uzbanintam zmogui informacija, gali tiesiog type atsiust banned ir as ten parasysiu tarkim
                You have been banned from this chat. Jeigu praskipina type atsiustum skipped ar kazkas ir your song was skipped isprintinciau.
            */
      if (rooms[roomId]) {
        let response = {
          type: "banned",
          roomId: roomId,
          username: contents.text,
        };
        rooms[roomId].clients.forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify(response));
        });
      }
    } else if (contents.type === "skip") {
      if (rooms[roomId].queue.length === 0) return;
      let response = {
        type: "skipped",
        roomId: roomId,
        userId: rooms[roomId].queue[0].userId,
      };
      rooms[roomId].clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN)
          client.send(JSON.stringify(response));
      });
      rooms[roomId].removeSong(true);
      sendQueueUpdate(roomId, rooms[roomId].queue.length === 0, true, false);
      rooms[roomId].startNextSong();
    } else if (contents.type === "takeOutSong") {
      if (rooms[roomId]) {
        let result = rooms[roomId].removeSongByUserId(contents.userId);
        if (result === "FAIL") return; // RENALDAS: jei queue tuscia ar sis zmogus nebuvo idejes daina grazina "FAIL".
        let response = {
          type: "tookOutSong",
          roomId: roomId,
          userId: contents.userId,
        };
        rooms[roomId].clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify(response));
        });
      }
      sendQueueUpdate(roomId, contents.userId, null, null);
    }
  });
  ws.on("close", function () {
    let roomIdToRemove = null;
  
    // Find the room the user is in
    for (let roomId in rooms) {
      if (rooms.hasOwnProperty(roomId) && rooms[roomId].clients.has(ws)) {
        roomIdToRemove = roomId;
        rooms[roomId].clients.delete(ws);
        break;
      }
    }
  
    if (roomIdToRemove) {
      let userIdToRemove = ws.userId;
  
      const indexToRemove = rooms[roomIdToRemove].queue.findIndex(
        (videoInfo) => videoInfo.userId === userIdToRemove
      );
  
      if (indexToRemove !== -1) {
        const isDJ = indexToRemove === 0;
  
        if (isDJ) {
          onSongEnd(roomIdToRemove);
          rooms[roomIdToRemove].removeSong(true);
          if (rooms[roomIdToRemove].queue.length > 0) {
            clearTimeout(rooms[roomIdToRemove].timeoutId);
            rooms[roomIdToRemove].startNextSong();
          }
        } else {
          rooms[roomIdToRemove].queue.splice(indexToRemove, 1);
        }
        sendQueueUpdate(roomIdToRemove, null, false, userIdToRemove);
      }
  
      const clientSizeCount = rooms[roomIdToRemove].clients.size;
      rooms[roomIdToRemove].clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          const response = {
            type: "clientSizeUpdate",
            clientsCount: clientSizeCount,
            clients: rooms[roomIdToRemove].clients,
            elapsedTime: rooms[roomIdToRemove].getElapsedTime(),
          };
          client.send(JSON.stringify(response));
        }
      });
    }
  });
});

server.listen(port, function () {
  console.log(`Server is listening on ${port}!`);
});

function onSongStart(roomId) {
  console.log("Song started");
  rooms[roomId].isPlaying = true;
  rooms[roomId].resetLikes();
  const response = {
    type: "songStart",
    roomId: roomId,
    elapsedTime: rooms[roomId].getElapsedTime(),
    isPlaying: true,
  };

  rooms[roomId].clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  });
}

function onSongEnd(roomId) {
  console.log("Song ended");
  rooms[roomId].isPlaying = false;
  const response = {
    type: "songEnd",
    roomId: roomId,
    isPlaying: false,
  };

  rooms[roomId].clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  });
}

function sendQueueUpdate(roomId, state, isUpdateButtonsNeeded, finishedUserId) {
  console.log("sendQueueUpdate triggered");
  let sanitizedQueue = rooms[roomId].queue.map((videoInfo) => {
    return {
      userId: videoInfo.userId,
      username: videoInfo.username,
      songDuration: videoInfo.songDuration,
      videoTitle: videoInfo.videoTitle,
      link: videoInfo.link,
    };
  });

  let response = {
    type: "queueUpdate",
    roomId: roomId,
    isEmpty: state,
    isUpdateForButtons: isUpdateButtonsNeeded,
    queue: sanitizedQueue,
    finishedUserId,
  };

  rooms[roomId].clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN)
      client.send(JSON.stringify(response));
  });
}
