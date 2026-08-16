const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Snapshot = require('../models/Snapshot');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');

const snapshotsMap = new Map(); // roomId -> Array of snapshots
let isFileLoaded = false;

const loadFromFile = () => {
  if (isFileLoaded) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const content = fs.readFileSync(SNAPSHOTS_FILE, 'utf8');
      if (content.trim()) {
        const data = JSON.parse(content);
        for (const [rId, list] of Object.entries(data)) {
          snapshotsMap.set(rId, list);
        }
      }
    }
    isFileLoaded = true;
  } catch (err) {
    console.error('Error loading snapshots from file:', err);
    isFileLoaded = true;
  }
};

const saveToFile = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj = {};
    for (const [rId, list] of snapshotsMap.entries()) {
      obj[rId] = list;
    }
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving snapshots to file:', err);
  }
};

/**
 * Capture a new snapshot for a room
 */
const captureSnapshot = async (roomId, {
  userId = '',
  userName = '',
  boardData = [],
  files = [],
  activeFileId = null,
  codeData = '',
  language = 'javascript',
  executionOutput = null,
  actionType = 'general'
}) => {
  loadFromFile();

  const snapshotId = uuidv4();
  const timestamp = new Date().toISOString();

  // Deep clone complex fields to ensure in-memory array mutations do not mutate historical snapshots
  const clonedBoardData = Array.isArray(boardData) ? JSON.parse(JSON.stringify(boardData)) : [];
  const clonedFiles = Array.isArray(files) ? JSON.parse(JSON.stringify(files)) : [];
  const clonedOutput = executionOutput ? JSON.parse(JSON.stringify(executionOutput)) : null;

  const newSnapshot = {
    snapshotId,
    roomId,
    userId: String(userId || ''),
    userName: String(userName || ''),
    boardData: clonedBoardData,
    files: clonedFiles,
    activeFileId: activeFileId || null,
    codeData: codeData !== undefined ? String(codeData) : '',
    language: language || 'javascript',
    executionOutput: clonedOutput,
    actionType: actionType || 'general',
    timestamp
  };

  // Add to in-memory map
  if (!snapshotsMap.has(roomId)) {
    snapshotsMap.set(roomId, []);
  }
  const list = snapshotsMap.get(roomId);

  // Avoid duplicate identical snapshots — check ALL workspace fields
  const last = list[list.length - 1];
  const boardIdentical = last && JSON.stringify(last.boardData) === JSON.stringify(newSnapshot.boardData);
  const filesIdentical = last && JSON.stringify(last.files) === JSON.stringify(newSnapshot.files);
  const activeFileIdentical = last && last.activeFileId === newSnapshot.activeFileId;
  const codeIdentical = last && last.codeData === newSnapshot.codeData;
  const langIdentical = last && last.language === newSnapshot.language;
  const outputIdentical = last && JSON.stringify(last.executionOutput) === JSON.stringify(newSnapshot.executionOutput);
  const userIdentical = last && last.userId === newSnapshot.userId;

  if (boardIdentical && filesIdentical && activeFileIdentical && codeIdentical && langIdentical && outputIdentical && userIdentical) {
    return null; // No changes since last snapshot
  }

  list.push(newSnapshot);
  saveToFile();

  // Save to MongoDB if available
  if (Snapshot && Snapshot.db && Snapshot.db.readyState === 1) {
    try {
      await Snapshot.create({
        snapshotId,
        roomId,
        userId: newSnapshot.userId,
        userName: newSnapshot.userName,
        boardData: newSnapshot.boardData,
        files: newSnapshot.files,
        activeFileId: newSnapshot.activeFileId,
        codeData: newSnapshot.codeData,
        language: newSnapshot.language,
        executionOutput: newSnapshot.executionOutput,
        actionType: newSnapshot.actionType,
        timestamp: new Date(timestamp)
      });
    } catch (err) {
      console.error('MongoDB snapshot write error:', err.message);
    }
  }

  return newSnapshot;
};

/**
 * Get sorted snapshot timeline for a room (optionally filtered by user ID)
 */
const getSnapshots = async (roomId, userId = null) => {
  loadFromFile();

  let list = [];

  if (Snapshot && Snapshot.db && Snapshot.db.readyState === 1) {
    try {
      const query = { roomId };
      if (userId) {
        query.$or = [{ userId: String(userId) }, { userId: '' }, { userId: { $exists: false } }];
      }
      const dbSnapshots = await Snapshot.find(query).sort({ timestamp: 1 });
      if (dbSnapshots && dbSnapshots.length > 0) {
        list = dbSnapshots.map(s => ({
          snapshotId: s.snapshotId,
          roomId: s.roomId,
          userId: s.userId || '',
          userName: s.userName || '',
          boardData: s.boardData || [],
          files: s.files || [],
          activeFileId: s.activeFileId || null,
          codeData: s.codeData || '',
          language: s.language || 'javascript',
          executionOutput: s.executionOutput || null,
          actionType: s.actionType || 'general',
          timestamp: s.timestamp ? s.timestamp.toISOString() : new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error('MongoDB snapshot query error:', err.message);
    }
  }

  if (list.length === 0 && snapshotsMap.has(roomId)) {
    list = snapshotsMap.get(roomId) || [];
  }

  // Filter in-memory snapshots by userId if provided
  if (userId && list.length > 0) {
    const targetIdStr = String(userId);
    const userSnapshots = list.filter(s => !s.userId || String(s.userId) === targetIdStr);
    // If user has specific snapshots, return only userSnapshots; otherwise fall back to all room snapshots
    if (userSnapshots.length > 0) {
      list = userSnapshots;
    }
  }

  // Ensure chronological order
  return list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

module.exports = {
  captureSnapshot,
  getSnapshots
};
