const socket = new WebSocket("ws://localhost:4000");
const msg = "Hello world";
// message is received
socket.addEventListener("message", (event) => {
  console.log(event.data);
});

// socket opened
socket.addEventListener("open", (event) => {
  console.log("Open");
});

// socket closed
socket.addEventListener("close", (event) => {
  console.log("Close");
});

// error handler
socket.addEventListener("error", (event) => {
  console.log("Error");
});
