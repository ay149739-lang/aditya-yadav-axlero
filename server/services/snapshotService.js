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
const captureSnapshot = async (roomId, { boardData, codeData, language }) => {
  loadFromFile();

  const snapshotId = uuidv4();
  const timestamp = new Date().toISOString();

  const newSnapshot = {
    snapshotId,
    roomId,
    boardData: Array.isArray(boardData) ? boardData : [],
    codeData: codeData !== undefined ? codeData : '',
    language: language || 'javascript',
    timestamp
  };

  // Add to in-memory map
  if (!snapshotsMap.has(roomId)) {
    snapshotsMap.set(roomId, []);
  }
  const list = snapshotsMap.get(roomId);

  // Avoid duplicate identical snapshots — only skip if ALL fields are completely identical
  const last = list[list.length - 1];
  const boardIdentical = last && JSON.stringify(last.boardData) === JSON.stringify(newSnapshot.boardData);
  const codeIdentical = last && last.codeData === newSnapshot.codeData;
  const langIdentical = last && last.language === newSnapshot.language;
  if (boardIdentical && codeIdentical && langIdentical) {
    return last; // No changes since last snapshot
  }

  list.push(newSnapshot);
  saveToFile();

  // Save to MongoDB if available
  if (Snapshot && Snapshot.db && Snapshot.db.readyState === 1) {
    try {
      await Snapshot.create({
        snapshotId,
        roomId,
        boardData: newSnapshot.boardData,
        codeData: newSnapshot.codeData,
        language: newSnapshot.language,
        timestamp: new Date(timestamp)
      });
    } catch (err) {
      console.error('MongoDB snapshot write error:', err.message);
    }
  }

  return newSnapshot;
};

/**
 * Get sorted snapshot timeline for a room
 */
const getSnapshots = async (roomId) => {
  loadFromFile();

  let list = [];

  if (Snapshot && Snapshot.db && Snapshot.db.readyState === 1) {
    try {
      const dbSnapshots = await Snapshot.find({ roomId }).sort({ timestamp: 1 });
      if (dbSnapshots && dbSnapshots.length > 0) {
        list = dbSnapshots.map(s => ({
          snapshotId: s.snapshotId,
          roomId: s.roomId,
          boardData: s.boardData || [],
          codeData: s.codeData || '',
          language: s.language || 'javascript',
          timestamp: s.timestamp.toISOString()
        }));
      }
    } catch (err) {
      console.error('MongoDB snapshot query error:', err.message);
    }
  }

  if (list.length === 0 && snapshotsMap.has(roomId)) {
    list = snapshotsMap.get(roomId);
  }

  // Ensure chronological order
  return list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

module.exports = {
  captureSnapshot,
  getSnapshots
};
