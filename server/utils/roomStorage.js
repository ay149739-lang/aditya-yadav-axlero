const fs = require('fs');
const path = require('path');
const Room = require('../models/Room');

const DEFAULT_CODE = `// Collaborative Workspace Editor\nfunction syncSpace() {\n  console.log("Realtime collaboration ready!");\n}\n\nsyncSpace();`;

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

// In-memory cache of room data
const roomsCache = new Map();
let isFileLoaded = false;
let saveTimeout = null;

// Ensure data directory and file exist
const ensureFileExists = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
    }
  } catch (err) {
    console.error('Error creating data directory/file:', err);
  }
};

// Load rooms from JSON file into cache
const loadFromFile = () => {
  if (isFileLoaded) return;
  ensureFileExists();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content.trim()) {
        const data = JSON.parse(content);
        for (const [roomId, room] of Object.entries(data)) {
          roomsCache.set(roomId, room);
        }
      }
    }
    isFileLoaded = true;
  } catch (err) {
    console.error('Error loading rooms from file:', err);
    isFileLoaded = true;
  }
};

// Save cache to JSON file (debounced)
const scheduleSaveToFile = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveToFileImmediate();
  }, 1000);
};

// Immediate save to JSON file
const saveToFileImmediate = () => {
  ensureFileExists();
  try {
    const dataObj = {};
    for (const [roomId, room] of roomsCache.entries()) {
      dataObj[roomId] = {
        roomId: room.roomId,
        roomName: room.roomName || room.roomId,
        owner: room.owner ? room.owner.toString() : null,
        members: Array.isArray(room.members) ? room.members.map(m => m.toString()) : [],
        pendingInvites: Array.isArray(room.pendingInvites) ? room.pendingInvites.map(m => m.toString()) : [],
        invitedUsers: Array.isArray(room.invitedUsers) ? room.invitedUsers.map(m => m.toString()) : [],
        accessRequests: Array.isArray(room.accessRequests) ? room.accessRequests : [],
        isPublic: Boolean(room.isPublic),
        boardData: room.boardData || [],
        codeData: room.codeData !== undefined ? room.codeData : DEFAULT_CODE,
        language: room.language || 'javascript',
        updatedAt: new Date().toISOString()
      };
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing rooms to file:', err);
  }
};

/**
 * Get room data by roomId.
 * Returns null if room does not exist.
 */
const getRoom = async (roomId) => {
  loadFromFile();

  let roomData = null;

  // Attempt MongoDB fetch if ready
  if (Room && Room.db && Room.db.readyState === 1) {
    try {
      const dbRoom = await Room.findOne({ roomId });
      if (dbRoom) {
        const owner = dbRoom.owner ? dbRoom.owner.toString() : null;
        const membersSet = new Set((Array.isArray(dbRoom.members) ? dbRoom.members : []).map(m => m.toString()));
        if (owner) membersSet.add(owner);

        roomData = {
          roomId: dbRoom.roomId,
          roomName: dbRoom.roomName || dbRoom.roomId,
          owner: owner,
          members: Array.from(membersSet),
          pendingInvites: (Array.isArray(dbRoom.pendingInvites) ? dbRoom.pendingInvites : []).map(m => m.toString()),
          invitedUsers: (Array.isArray(dbRoom.invitedUsers) ? dbRoom.invitedUsers : []).map(m => m.toString()),
          accessRequests: Array.isArray(dbRoom.accessRequests) ? dbRoom.accessRequests : [],
          isPublic: Boolean(dbRoom.isPublic),
          boardData: dbRoom.boardData || [],
          codeData: dbRoom.codeData !== undefined ? dbRoom.codeData : DEFAULT_CODE,
          language: dbRoom.language || 'javascript'
        };
        roomsCache.set(roomId, roomData);
      }
    } catch (err) {
      console.error(`MongoDB read error for room ${roomId}:`, err.message);
    }
  }

  // Fallback to cache if MongoDB didn't return a record
  if (!roomData && roomsCache.has(roomId)) {
    const cached = roomsCache.get(roomId);
    const owner = cached.owner ? cached.owner.toString() : null;
    const membersSet = new Set((Array.isArray(cached.members) ? cached.members : []).map(m => m.toString()));
    if (owner) membersSet.add(owner);

    roomData = {
      ...cached,
      owner,
      members: Array.from(membersSet),
      pendingInvites: (Array.isArray(cached.pendingInvites) ? cached.pendingInvites : []).map(m => m.toString()),
      invitedUsers: (Array.isArray(cached.invitedUsers) ? cached.invitedUsers : []).map(m => m.toString())
    };
  }

  return roomData;
};

/**
 * Save room data for roomId.
 * Preserves owner & members if not explicitly provided.
 */
const saveRoom = async (roomId, data) => {
  loadFromFile();

  let existing = roomsCache.get(roomId);
  if (!existing) {
    existing = await getRoom(roomId) || {};
  }

  const roomName = data.roomName !== undefined ? data.roomName : (existing.roomName || roomId);
  const rawOwner = (data.owner !== undefined && data.owner !== null) 
    ? data.owner 
    : (existing.owner || (Array.isArray(existing.members) && existing.members.length > 0 ? existing.members[0] : null));
  const owner = rawOwner ? rawOwner.toString().trim() : null;
  
  const rawMembers = Array.isArray(data.members) ? data.members : (existing.members || []);
  const membersList = rawMembers.map(m => m.toString().trim());
  if (owner && !membersList.includes(owner)) {
    membersList.unshift(owner);
  } else if (owner && membersList.includes(owner) && membersList[0] !== owner) {
    const idx = membersList.indexOf(owner);
    if (idx !== -1) {
      membersList.splice(idx, 1);
      membersList.unshift(owner);
    }
  }
  const members = Array.from(new Set(membersList));

  const pendingInvites = Array.isArray(data.pendingInvites) ? data.pendingInvites.map(m => m.toString()) : (existing.pendingInvites || []);
  const invitedUsers = Array.isArray(data.invitedUsers) ? data.invitedUsers.map(m => m.toString()) : (existing.invitedUsers || []);
  const accessRequests = Array.isArray(data.accessRequests) ? data.accessRequests : (existing.accessRequests || []);
  const isPublic = data.isPublic !== undefined ? data.isPublic : Boolean(existing.isPublic);
  const boardData = Array.isArray(data.boardData) ? data.boardData : (existing.boardData || []);
  const codeData = data.codeData !== undefined ? data.codeData : (existing.codeData !== undefined ? existing.codeData : DEFAULT_CODE);
  const language = data.language || existing.language || 'javascript';

  const roomToSave = {
    roomId,
    roomName,
    owner,
    members,
    pendingInvites,
    invitedUsers,
    accessRequests,
    isPublic,
    boardData,
    codeData,
    language
  };

  // Update in-memory cache
  roomsCache.set(roomId, roomToSave);

  // Save to MongoDB if available
  if (Room && Room.db && Room.db.readyState === 1) {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $set: roomToSave },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (err) {
      console.error(`MongoDB write error for room ${roomId}:`, err.message);
    }
  }

  // Schedule disk file save
  scheduleSaveToFile();

  return roomToSave;
};

/**
 * Get all rooms (from MongoDB if ready, or in-memory cache)
 */
const getAllRooms = async () => {
  loadFromFile();
  const roomsMap = new Map(roomsCache);

  if (Room && Room.db && Room.db.readyState === 1) {
    try {
      const dbRooms = await Room.find({});
      for (const dbRoom of dbRooms) {
        const owner = dbRoom.owner ? dbRoom.owner.toString() : null;
        const membersSet = new Set((Array.isArray(dbRoom.members) ? dbRoom.members : []).map(m => m.toString()));
        if (owner) membersSet.add(owner);

        roomsMap.set(dbRoom.roomId, {
          roomId: dbRoom.roomId,
          roomName: dbRoom.roomName || dbRoom.roomId,
          owner: owner,
          members: Array.from(membersSet),
          pendingInvites: (Array.isArray(dbRoom.pendingInvites) ? dbRoom.pendingInvites : []).map(m => m.toString()),
          invitedUsers: (Array.isArray(dbRoom.invitedUsers) ? dbRoom.invitedUsers : []).map(m => m.toString()),
          accessRequests: Array.isArray(dbRoom.accessRequests) ? dbRoom.accessRequests : [],
          isPublic: Boolean(dbRoom.isPublic),
          boardData: dbRoom.boardData || [],
          codeData: dbRoom.codeData !== undefined ? dbRoom.codeData : DEFAULT_CODE,
          language: dbRoom.language || 'javascript',
          updatedAt: dbRoom.updatedAt || new Date()
        });
      }
    } catch (err) {
      console.error('MongoDB getAllRooms error:', err.message);
    }
  }

  return Array.from(roomsMap.values());
};

/**
 * Delete room by roomId
 */
const deleteRoom = async (roomId) => {
  loadFromFile();
  roomsCache.delete(roomId);

  if (Room && Room.db && Room.db.readyState === 1) {
    try {
      await Room.deleteOne({ roomId });
    } catch (err) {
      console.error(`MongoDB delete room error for ${roomId}:`, err.message);
    }
  }

  scheduleSaveToFile();
  return true;
};

/**
 * Force immediate disk save
 */
const flushSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveToFileImmediate();
};

module.exports = {
  getRoom,
  saveRoom,
  getAllRooms,
  deleteRoom,
  flushSave,
  DEFAULT_CODE
};

