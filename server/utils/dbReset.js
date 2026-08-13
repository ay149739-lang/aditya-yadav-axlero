const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Room = require('../models/Room');
const Invitation = require('../models/Invitation');
const Snapshot = require('../models/Snapshot');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MARKER_FILE = path.join(DATA_DIR, '.reset_vFinal_completed');

const dbReset = async () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Check if one-time reset has already been performed
    if (fs.existsSync(MARKER_FILE)) {
      console.log('Database reset marker found — skipping development reset.');
      return;
    }

    console.log('Performing ONE-TIME development database and storage reset...');

    // 1. Clear local JSON storage files
    const filesToReset = ['users.json', 'rooms.json', 'invitations.json', 'snapshots.json'];
    for (const fileName of filesToReset) {
      const filePath = path.join(DATA_DIR, fileName);
      fs.writeFileSync(filePath, JSON.stringify({}), 'utf8');
    }

    // 2. Clear MongoDB collections if connected
    if (User && User.db && User.db.readyState === 1) {
      try {
        await User.deleteMany({});
        console.log('MongoDB User collection cleared.');
      } catch (e) {
        console.error('Error clearing User collection:', e.message);
      }
    }

    if (Room && Room.db && Room.db.readyState === 1) {
      try {
        await Room.deleteMany({});
        console.log('MongoDB Room collection cleared.');
      } catch (e) {
        console.error('Error clearing Room collection:', e.message);
      }
    }

    if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
      try {
        await Invitation.deleteMany({});
        console.log('MongoDB Invitation collection cleared.');
      } catch (e) {
        console.error('Error clearing Invitation collection:', e.message);
      }
    }

    if (Snapshot && Snapshot.db && Snapshot.db.readyState === 1) {
      try {
        await Snapshot.deleteMany({});
        console.log('MongoDB Snapshot collection cleared.');
      } catch (e) {
        console.error('Error clearing Snapshot collection:', e.message);
      }
    }

    // 3. Write marker file so reset never runs again
    fs.writeFileSync(MARKER_FILE, `Reset completed at ${new Date().toISOString()}`, 'utf8');
    console.log('One-time database reset completed successfully.');
  } catch (error) {
    console.error('Error during database reset:', error);
  }
};

module.exports = dbReset;
