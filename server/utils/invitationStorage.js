const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Invitation = require('../models/Invitation');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'invitations.json');

const invitationsCache = new Map();
let isFileLoaded = false;
let saveTimeout = null;

const ensureFileExists = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
    }
  } catch (err) {
    console.error('Error creating invitations data directory/file:', err);
  }
};

const loadFromFile = () => {
  if (isFileLoaded) return;
  ensureFileExists();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content.trim()) {
        const data = JSON.parse(content);
        for (const [id, inv] of Object.entries(data)) {
          invitationsCache.set(id, inv);
        }
      }
    }
    isFileLoaded = true;
  } catch (err) {
    console.error('Error loading invitations from file:', err);
    isFileLoaded = true;
  }
};

const scheduleSaveToFile = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveToFileImmediate();
  }, 1000);
};

const saveToFileImmediate = () => {
  ensureFileExists();
  try {
    const dataObj = {};
    for (const [id, inv] of invitationsCache.entries()) {
      dataObj[id] = inv;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing invitations to file:', err);
  }
};

const createInvitation = async ({ roomId, roomName, ownerId, ownerName, invitedUserId, invitedUsername }) => {
  loadFromFile();
  const id = uuidv4();
  const now = new Date().toISOString();

  const invitationData = {
    id,
    _id: id,
    roomId,
    roomName,
    owner: ownerId.toString(),
    ownerName: ownerName || 'Owner',
    invitedUser: invitedUserId.toString(),
    invitedUsername: invitedUsername || 'User',
    status: 'pending',
    createdAt: now,
    acceptedAt: null,
    rejectedAt: null
  };

  invitationsCache.set(id, invitationData);

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      const dbInv = await Invitation.create({
        roomId,
        roomName,
        owner: ownerId.toString(),
        ownerName: ownerName || 'Owner',
        invitedUser: invitedUserId.toString(),
        invitedUsername: invitedUsername || 'User',
        status: 'pending'
      });
      invitationData._id = dbInv._id.toString();
      invitationData.id = dbInv._id.toString();
      invitationsCache.set(invitationData.id, invitationData);
    } catch (err) {
      console.error('MongoDB write error for invitation:', err.message);
    }
  }

  scheduleSaveToFile();
  return invitationData;
};

const getPendingInvitationsForUser = async (userId) => {
  loadFromFile();
  const targetId = (userId || '').toString();
  const results = [];

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      const dbInvs = await Invitation.find({ invitedUser: targetId, status: 'pending' }).sort({ createdAt: -1 });
      return dbInvs.map(inv => ({
        id: inv._id.toString(),
        _id: inv._id.toString(),
        roomId: inv.roomId,
        roomName: inv.roomName,
        owner: inv.owner,
        ownerName: inv.ownerName || 'Owner',
        invitedUser: inv.invitedUser,
        invitedUsername: inv.invitedUsername,
        status: inv.status,
        createdAt: inv.createdAt
      }));
    } catch (err) {
      console.error('MongoDB read error for pending invitations:', err.message);
    }
  }

  for (const inv of invitationsCache.values()) {
    if (inv.invitedUser.toString() === targetId && inv.status === 'pending') {
      results.push(inv);
    }
  }

  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getAllInvitationsForUser = async (userId) => {
  loadFromFile();
  const targetId = (userId || '').toString();
  const allList = [];

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      const dbInvs = await Invitation.find({ invitedUser: targetId }).sort({ createdAt: -1 });
      const mapped = dbInvs.map(inv => ({
        id: inv._id.toString(),
        _id: inv._id.toString(),
        roomId: inv.roomId,
        roomName: inv.roomName,
        owner: inv.owner,
        ownerName: inv.ownerName || 'Owner',
        invitedUser: inv.invitedUser,
        invitedUsername: inv.invitedUsername,
        status: inv.status,
        createdAt: inv.createdAt
      }));
      return {
        pending: mapped.filter(i => i.status === 'pending'),
        accepted: mapped.filter(i => i.status === 'accepted'),
        rejected: mapped.filter(i => i.status === 'rejected' || i.status === 'declined'),
        declined: mapped.filter(i => i.status === 'rejected' || i.status === 'declined'),
        all: mapped
      };
    } catch (err) {
      console.error('MongoDB read error for all invitations:', err.message);
    }
  }

  for (const inv of invitationsCache.values()) {
    if (inv.invitedUser.toString() === targetId) {
      allList.push(inv);
    }
  }

  const sorted = allList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    pending: sorted.filter(i => i.status === 'pending'),
    accepted: sorted.filter(i => i.status === 'accepted'),
    rejected: sorted.filter(i => i.status === 'rejected' || i.status === 'declined'),
    declined: sorted.filter(i => i.status === 'rejected' || i.status === 'declined'),
    all: sorted
  };
};

const getInvitationById = async (invitationId) => {
  loadFromFile();

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      const dbInv = await Invitation.findById(invitationId);
      if (dbInv) {
        return {
          id: dbInv._id.toString(),
          _id: dbInv._id.toString(),
          roomId: dbInv.roomId,
          roomName: dbInv.roomName,
          owner: dbInv.owner,
          ownerName: dbInv.ownerName || 'Owner',
          invitedUser: dbInv.invitedUser,
          invitedUsername: dbInv.invitedUsername,
          status: dbInv.status,
          createdAt: dbInv.createdAt,
          acceptedAt: dbInv.acceptedAt,
          rejectedAt: dbInv.rejectedAt,
          declinedAt: dbInv.declinedAt
        };
      }
    } catch (err) {
      // ignore & fallback
    }
  }

  return invitationsCache.get(invitationId) || null;
};

const updateInvitationStatus = async (invitationId, status) => {
  loadFromFile();
  const inv = await getInvitationById(invitationId);
  if (!inv) return null;

  const now = new Date().toISOString();
  inv.status = status;
  if (status === 'accepted') inv.acceptedAt = now;
  if (status === 'rejected') inv.rejectedAt = now;
  if (status === 'declined') inv.declinedAt = now;

  invitationsCache.set(invitationId, inv);

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      await Invitation.findByIdAndUpdate(invitationId, {
        status,
        acceptedAt: status === 'accepted' ? new Date() : null,
        rejectedAt: status === 'rejected' ? new Date() : null,
        declinedAt: status === 'declined' ? new Date() : null
      });
    } catch (err) {
      console.error('MongoDB update error for invitation:', err.message);
    }
  }

  scheduleSaveToFile();
  return inv;
};

const findPendingInvitation = async (roomId, invitedUserId) => {
  loadFromFile();
  const targetId = (invitedUserId || '').toString();

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      const dbInv = await Invitation.findOne({ roomId, invitedUser: targetId, status: 'pending' });
      if (dbInv) return dbInv;
    } catch (err) {
      // ignore
    }
  }

  for (const inv of invitationsCache.values()) {
    if (inv.roomId === roomId && inv.invitedUser.toString() === targetId && inv.status === 'pending') {
      return inv;
    }
  }

  return null;
};

const deleteInvitationsForRoomAndUser = async (roomId, targetUserId) => {
  loadFromFile();
  const roomStr = (roomId || '').toString();
  const userStr = (targetUserId || '').toString();

  for (const [id, inv] of Array.from(invitationsCache.entries())) {
    const invRoom = (inv.roomId || '').toString();
    const invUser = (inv.invitedUser || '').toString();
    const invUserUsername = (inv.invitedUsername || '').toString().toLowerCase();

    if (invRoom === roomStr && (invUser === userStr || invUserUsername === userStr.toLowerCase())) {
      invitationsCache.delete(id);
    }
  }

  saveToFileImmediate();

  if (Invitation && Invitation.db && Invitation.db.readyState === 1) {
    try {
      await Invitation.deleteMany({
        roomId: roomStr,
        $or: [
          { invitedUser: userStr },
          { invitedUsername: userStr.toLowerCase() }
        ]
      });
    } catch (err) {
      console.error('MongoDB delete invitations error:', err.message);
    }
  }
};

module.exports = {
  createInvitation,
  getPendingInvitationsForUser,
  getAllInvitationsForUser,
  getInvitationById,
  updateInvitationStatus,
  findPendingInvitation,
  deleteInvitationsForRoomAndUser
};
