const { v4: uuidv4 } = require('uuid');

const rooms = new Map(); // Room state

module.exports = (io) => {
  io.on("connection", (socket) =>  {
    console.log("User Connected:", socket.id);

    socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);
      
      const userData = { ...user, id: socket.id, socketId: socket.id };
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map(), shapes: [] });
      }
      
      const room = rooms.get(roomId);
      room.users.set(socket.id, userData);

      // Broadcast to others in room
      socket.to(roomId).emit("user-joined", userData);
      
      // Send current users to the joined user
      const usersList = Array.from(room.users.values());
      socket.emit("room-data", { users: usersList });
      
      // Send existing shapes to the newly joined user
      socket.emit("initial-shapes", room.shapes);

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

    // Week 2 Day 1: Placeholder socket events
    socket.on("draw-start", (data) =>{
      const room = rooms.get(data.roomId);
      if (room) room.shapes.push(data);
      socket.to(data.roomId).emit("draw-start", data); 
    });

    socket.on("drawing", (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
        const index = room.shapes.findIndex(s => s.id === data.id);
        if (index !== -1) room.shapes[index] = data;
        else room.shapes.push(data);
      }
      socket.to(data.roomId).emit("drawing", data);
    });

    socket.on("draw-end", (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
        const index = room.shapes.findIndex(s => s.id === data.id);
        if (index !== -1) room.shapes[index] = data;
        else room.shapes.push(data);
      }
      socket.to(data.roomId).emit("draw-end", data);
    });

    socket.on("clear-canvas", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.shapes = [];
      }
      io.to(roomId).emit("clear-canvas");
    });

    socket.on("cursor-move", (data) => {
      const room = rooms.get(data.roomId);
      const user = room?.users.get(socket.id);
      const name = user?.name || data.userName || 'User';
      socket.to(data.roomId).emit("cursor-move", { 
        ...data, 
        userId: socket.id,
        userName: name
      });
    });

    socket.on("code-change", (data) => {
      socket.to(data.roomId).emit("code-change", data);
    });
  });
};
