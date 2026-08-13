const { v4: uuidv4 } = require('uuid');
const roomStorage = require('../utils/roomStorage');
const { verifyToken } = require('../utils/jwt');
const { captureSnapshot } = require('../services/snapshotService');

const rooms = new Map(); // Room state in memory
const lastSnapshotTimestamps = new Map(); // roomId -> timestamp ms

let ioInstance = null;

const triggerDebouncedSnapshot = (roomId, boardData, codeData, language) => {
  const now = Date.now();
  const lastTime = lastSnapshotTimestamps.get(roomId) || 0;
  if (now - lastTime > 1500) {
    lastSnapshotTimestamps.set(roomId, now);
    captureSnapshot(roomId, { boardData, codeData, language })
      .then(snap => {
        if (snap && ioInstance) {
          ioInstance.to(roomId).emit("new-snapshot", snap);
        }
      })
      .catch(err => {
        console.error('Auto snapshot capture error:', err);
      });
  }
};

/**
 * Filters room.users to ensure only currently connected live sockets are returned.
 * Strictly deduplicates users so each user ID appears at most ONCE.
 * Removes any disconnected or stale socket IDs from memory.
 */
const getValidActiveUsers = (io, room) => {
  if (!room || !room.users) return [];
  const validUsers = [];
  const seenUserKeys = new Set();

  const socketsMap = io?.sockets?.sockets || io?.of("/")?.sockets;

  for (const [socketId, userData] of Array.from(room.users.entries())) {
    let activeSocket = null;
    if (socketsMap) {
      if (typeof socketsMap.get === 'function') {
        activeSocket = socketsMap.get(socketId);
      } else {
        activeSocket = socketsMap[socketId];
      }
    }

    // Only purge if socket object is explicitly found AND disconnected
    const isLive = activeSocket ? Boolean(activeSocket.connected) : true;

    if (isLive) {
      const userKey = (userData.userId || userData.id || userData.username || '').toString().toLowerCase();
      if (userKey && !seenUserKeys.has(userKey)) {
        seenUserKeys.add(userKey);
        validUsers.push(userData);
      }
    } else {
      room.users.delete(socketId);
    }
  }
  return validUsers;
};

const recentlyLeftMap = new Map(); // `${roomId}:${targetId}` -> timestamp ms

/**
 * Instantly removes a user from a room's active users memory map
 * and broadcasts updated active user list to all remaining connected clients.
 */
const removeUserFromRoom = (roomId, userId = null, socketId = null) => {
  if (!roomId || !rooms.has(roomId)) return;
  const room = rooms.get(roomId);
  if (!room || !room.users) return;

  let removed = false;
  let targetSocketId = socketId;

  for (const [sId, uData] of Array.from(room.users.entries())) {
    const matchesSocket = Boolean(socketId && (sId === socketId || uData.socketId === socketId || uData.id === socketId));
    const matchesUser = Boolean(!socketId && userId && (uData.userId === userId.toString() || uData.id === userId.toString() || uData.username === userId.toString()));

    if (matchesSocket || matchesUser) {
      targetSocketId = targetSocketId || sId || uData.socketId || uData.id;
      room.users.delete(sId);
      removed = true;
    }
  }

  if (removed) {
    const broadcastKey = `${roomId}:${targetSocketId || userId}`;
    const now = Date.now();
    const lastBroadcast = recentlyLeftMap.get(broadcastKey) || 0;

    // Deduplicate backend broadcast: emit user-left ONLY ONCE within 2000ms window per user/room
    if (now - lastBroadcast > 2000) {
      recentlyLeftMap.set(broadcastKey, now);
      if (targetSocketId && ioInstance) {
        ioInstance.to(roomId).emit("user-left", targetSocketId);
      }
    }

    const remainingUsers = getValidActiveUsers(ioInstance, room);
    if (ioInstance) {
      ioInstance.to(roomId).emit("users-updated", remainingUsers);
    }

    roomStorage.saveRoom(roomId, {
      boardData: room.shapes,
      codeData: room.code,
      language: room.language
    });

    if (room.users.size === 0) {
      roomStorage.flushSave();
      rooms.delete(roomId);
    }

    // Clean up old entries from recentlyLeftMap if map grows
    if (recentlyLeftMap.size > 200) {
      for (const [k, time] of Array.from(recentlyLeftMap.entries())) {
        if (now - time > 10000) recentlyLeftMap.delete(k);
      }
    }
  }
};

module.exports = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    // Extract auth token from socket handshake
    const token = socket.handshake.auth?.token;
    const authUser = token ? verifyToken(token) : null;

    socket.on("join-room", async ({ roomId, user }) => {
      // Use User ID from JWT as the authoritative identifier
      const joiningUserId = authUser?.id?.toString() || null;
      const joiningUsername = authUser?.username || user?.username || 'User';

      if (!joiningUserId) {
        console.warn(`Socket join rejected: No valid JWT for socket ${socket.id}`);
        socket.emit("access-denied", {
          roomId,
          message: "You are not invited to this room."
        });
        return;
      }

      const savedRoom = await roomStorage.getRoom(roomId);

      if (!savedRoom) {
        console.warn(`Access denied for userId=${joiningUserId}: Room ${roomId} does not exist`);
        socket.emit("access-denied", {
          roomId,
          message: "You are not invited to this room."
        });
        return;
      }

      const roomOwnerId = savedRoom.owner ? savedRoom.owner.toString().trim() : '';
      const roomMembers = (savedRoom.members || []).map(m => m.toString().trim());
      const invitedUsers = (savedRoom.invitedUsers || []).map(m => m.toString().trim());
      const cleanJoiningUsername = joiningUsername.trim().toLowerCase();

      // Always ensure owner is in members list for check
      if (roomOwnerId && !roomMembers.includes(roomOwnerId)) roomMembers.push(roomOwnerId);

      const isOwner = Boolean(
        (roomOwnerId && roomOwnerId === joiningUserId) ||
        (roomOwnerId && cleanJoiningUsername && roomOwnerId.toLowerCase() === cleanJoiningUsername)
      );

      const isMember = roomMembers.some(m => m === joiningUserId || m.toLowerCase() === cleanJoiningUsername) ||
                       invitedUsers.some(m => m === joiningUserId || m.toLowerCase() === cleanJoiningUsername);
      const isPublic = Boolean(savedRoom.isPublic);

      if (!isOwner && !isMember && !isPublic) {
        console.warn(`Access denied for userId=${joiningUserId}/username=${joiningUsername} in private room ${roomId}`);
        socket.emit("access-denied", {
          roomId,
          message: "You are not invited to this room."
        });
        return;
      }

      // 1. Remove socket/user from any other rooms in memory
      for (const [otherRoomId, otherRoom] of Array.from(rooms.entries())) {
        if (otherRoomId !== roomId && otherRoom.users) {
          let modified = false;
          for (const [sId, uData] of Array.from(otherRoom.users.entries())) {
            if (sId === socket.id || uData.userId === joiningUserId) {
              otherRoom.users.delete(sId);
              modified = true;
            }
          }
          if (modified) {
            const remaining = getValidActiveUsers(io, otherRoom);
            io.to(otherRoomId).emit("user-left", socket.id);
            io.to(otherRoomId).emit("users-updated", remaining);
            if (otherRoom.users.size === 0) {
              rooms.delete(otherRoomId);
            }
          }
        }
      }

      socket.join(roomId);

      const userData = {
        ...user,
        id: socket.id,
        socketId: socket.id,
        userId: joiningUserId,
        username: joiningUsername,
        name: authUser?.name || user?.name || joiningUsername,
        color: authUser?.color || user?.color || '#6366F1',
        isOwner
      };

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          ownerId: roomOwnerId,
          shapes: savedRoom.boardData || [],
          code: savedRoom.codeData !== undefined ? savedRoom.codeData : roomStorage.DEFAULT_CODE,
          language: savedRoom.language || 'javascript'
        });
      }

      const room = rooms.get(roomId);

      // 2. Remove any previous/stale socket entries for this EXACT socket in target room
      for (const [sId, uData] of Array.from(room.users.entries())) {
        if (sId === socket.id || uData.socketId === socket.id) {
          room.users.delete(sId);
        }
      }

      // Add fresh live socket entry
      room.users.set(socket.id, userData);

      triggerDebouncedSnapshot(roomId, room.shapes, room.code, room.language);

      socket.to(roomId).emit("user-joined", userData);

      const usersList = getValidActiveUsers(io, room);
      socket.emit("room-data", { users: usersList, owner: room.ownerId });
      socket.emit("initial-shapes", room.shapes);
      socket.emit("initial-code", { code: room.code, language: room.language });

      console.log(`User ${userData.name}/${userData.username} (${socket.id}) joined room ${roomId} (Active users: ${usersList.length})`);
      io.to(roomId).emit("users-updated", usersList);
    });

    // Handle user leaving room (instant removal & broadcast)
    socket.on("leave-room", (data) => {
      const targetRoomId = (typeof data === 'string' ? data : data?.roomId) || null;
      const joiningUserId = authUser?.id?.toString() || null;

      if (targetRoomId) {
        removeUserFromRoom(targetRoomId, joiningUserId, socket.id);
        socket.leave(targetRoomId);
      } else {
        for (const [rId, room] of Array.from(rooms.entries())) {
          if (room.users && (room.users.has(socket.id) || Array.from(room.users.values()).some(u => u.socketId === socket.id))) {
            removeUserFromRoom(rId, joiningUserId, socket.id);
            socket.leave(rId);
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.id);
      const joiningUserId = authUser?.id?.toString() || null;
      for (const [roomId, room] of Array.from(rooms.entries())) {
        let isUserInRoom = false;
        for (const [sId, uData] of Array.from(room.users.entries())) {
          if (sId === socket.id || uData.socketId === socket.id) {
            isUserInRoom = true;
            break;
          }
        }
        if (isUserInRoom) {
          removeUserFromRoom(roomId, joiningUserId, socket.id);
        }
      }
    });

    socket.on("draw-start", (data) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (room) {
        room.shapes.push(data);
        roomStorage.saveRoom(data.roomId, { boardData: room.shapes, codeData: room.code, language: room.language });
      }
      socket.to(data.roomId).emit("draw-start", data);
    });

    socket.on("drawing", (data) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (room) {
        const index = room.shapes.findIndex(s => s.id === data.id);
        if (index !== -1) room.shapes[index] = data;
        else room.shapes.push(data);
      }
      socket.to(data.roomId).emit("drawing", data);
    });

    socket.on("draw-end", (data) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (room) {
        const index = room.shapes.findIndex(s => s.id === data.id);
        if (index !== -1) room.shapes[index] = data;
        else room.shapes.push(data);
        roomStorage.saveRoom(data.roomId, { boardData: room.shapes, codeData: room.code, language: room.language });
        triggerDebouncedSnapshot(data.roomId, room.shapes, room.code, room.language);
      }
      socket.to(data.roomId).emit("draw-end", data);
    });

    socket.on("delete-shape", ({ roomId, shapeId }) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        room.shapes = room.shapes.filter(s => s.id !== shapeId);
        roomStorage.saveRoom(roomId, { boardData: room.shapes, codeData: room.code, language: room.language });
        triggerDebouncedSnapshot(roomId, room.shapes, room.code, room.language);
      }
      socket.to(roomId).emit("delete-shape", { shapeId });
    });

    socket.on("clear-canvas", ({ roomId }) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        room.shapes = [];
        roomStorage.saveRoom(roomId, { boardData: [], codeData: room.code, language: room.language });
        triggerDebouncedSnapshot(roomId, [], room.code, room.language);
      }
      io.to(roomId).emit("clear-canvas");
    });

    socket.on("sync-shapes", ({ roomId, shapes }) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room && Array.isArray(shapes)) {
        room.shapes = shapes;
        roomStorage.saveRoom(roomId, { boardData: room.shapes, codeData: room.code, language: room.language });
        triggerDebouncedSnapshot(roomId, room.shapes, room.code, room.language);
      }
      socket.to(roomId).emit("sync-shapes", { shapes });
    });

    socket.on("cursor-move", (data) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      const user = room?.users.get(socket.id);
      const name = user?.name || data.userName || 'User';
      socket.to(data.roomId).emit("cursor-move", { ...data, userId: socket.id, userName: name });
    });

    socket.on("code-change", (data) => {
      if (!data?.roomId) return;
      const room = rooms.get(data.roomId);
      if (room) {
        if (data.code !== undefined) room.code = data.code;
        if (data.language !== undefined) room.language = data.language;
        roomStorage.saveRoom(data.roomId, { boardData: room.shapes, codeData: room.code, language: room.language });
        triggerDebouncedSnapshot(data.roomId, room.shapes, room.code, room.language);
      }
      socket.to(data.roomId).emit("code-change", data);
    });

    socket.on("cursor-change", (data) => {
      if (!data?.roomId) return;
      socket.to(data.roomId).emit("cursor-change", { ...data, userId: socket.id });
    });

    socket.on("code-executed", (data) => {
      if (!data?.roomId) return;
      io.to(data.roomId).emit("code-executed", data);
    });
  });
};

module.exports.removeUserFromRoom = removeUserFromRoom;

/**
 * Returns a plain object of { roomId -> userCount } for all rooms that
 * currently have at least one connected live user.
 */
module.exports.getActiveRooms = (io = ioInstance) => {
  const result = {};
  for (const [roomId, room] of Array.from(rooms.entries())) {
    if (room.users) {
      const validUsers = getValidActiveUsers(io, room);
      if (validUsers.length > 0) {
        result[roomId] = validUsers.length;
      } else {
        rooms.delete(roomId);
      }
    }
  }
  return result;
};

/**
 * Checks if the owner of a given roomId is currently online and connected in the room.
 */
module.exports.isOwnerOnline = (roomId, io = ioInstance) => {
  const room = rooms.get(roomId);
  if (!room || !room.users || room.users.size === 0) return false;
  const validUsers = getValidActiveUsers(io, room);
  for (const user of validUsers) {
    if (user.isOwner || (room.ownerId && (user.userId === room.ownerId || user.id === room.ownerId))) {
      return true;
    }
  }
  return false;
};
