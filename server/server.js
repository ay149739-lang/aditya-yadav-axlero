require("dotenv").config();
const express = require("express");
const http = require("http"); 
const cors = require("cors");
const { Server } = require("socket.io");
const setupSocket = require("./socket/socketHandler");

const app = express();
app.use(cors());
app.use(express.json());   

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

setupSocket(io);

const PORT = process.env.PORT || 5001;

app.get("/", (req, res) => {
  res.send("SyncSpace Server is running");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
