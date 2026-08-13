require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const setupSocket = require("./socket/socketHandler");
const connectDB = require("./utils/db");
const dbReset = require("./utils/dbReset");
const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB & execute one-time dev database reset
connectDB().then(() => {
  dbReset();
}).catch(() => {
  dbReset();
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

setupSocket(io);

const { protect } = require("./middleware/authMiddleware");
const {
  getNotificationsController,
  acceptInvitation,
  rejectInvitation
} = require("./controllers/inviteController");

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// Direct API Aliases
app.get("/api/notifications", protect, getNotificationsController);
app.post("/api/invitations/accept", protect, acceptInvitation);
app.post("/api/invitations/reject", protect, rejectInvitation);

app.get("/", (req, res) => {
  res.send("SyncSpace Server is running");
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
