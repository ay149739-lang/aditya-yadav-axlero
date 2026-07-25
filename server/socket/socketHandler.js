const { v4: uuidv4 } = require('uuid');

const rooms = new Map(); // Room state

module.exports = (io) => { 
  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);
      
      const userData = { id: socket.id, ...user };
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map() });
      }
      
      const room = rooms.get(roomId);
      room.users.set(socket.id, userData);

      // Broadcast to others in room
      socket.to(roomId).emit("user-joined", userData);
      
      // Send current users to the joined user
      const usersList = Array.from(room.users.values());
      socket.emit("room-data", { users: usersList });

      console.log(`User ${user.name} (${socket.id}) joined ${roomId}`);
      io.to(roomId).emit("users-updated", usersList);
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.id);
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          const usersList = Array.from(room.users.values());
          io.to(roomId).emit("user-left", socket.id);
          io.to(roomId).emit("users-updated", usersList);
          
          if (room.users.size === 0) {
             rooms.delete(roomId);
          }
          break;
        }
      }
    });
  });
};
