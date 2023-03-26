const idLength = 40;
function generateId() 
{
    const possibleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:',.<>/?`~";
    let id = "";
    for (let i = 0; i < idLength; i++) id += possibleChars[Math.floor(Math.random() * possibleChars.length)];
    return id;
}

function createRoom()
{
    let roomId = generateId();
    const message = 
    {
        type: "subscribe",
        roomId: roomId,
        username: document.querySelector("#username").value
    };
    sessionStorage.setItem("roomInfo", JSON.stringify(message));
    window.location.href = "../chat/chat.html";
}

function joinRoom()
{
    let roomId = document.querySelector("#joinRoomId").value;
    if (roomId.length === idLength)
    {
        const message = 
        {
            type: "subscribe",
            roomId: roomId,
            username: document.querySelector("#username").value
        };
        sessionStorage.setItem("roomInfo", JSON.stringify(message));
        window.location.href = "../chat/chat.html";
    }
}