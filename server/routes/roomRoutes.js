const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRoom,
  saveRoom,
  getUserRooms,
  getOwnedRooms,
  getJoinedRooms,
  deleteRoomController,
  leaveRoomController
} = require('../controllers/roomController');
const {
  inviteUser,
  getPendingInvitations,
  getNotificationsController,
  acceptInvitation,
  rejectInvitation,
  removeUser,
  checkAccess
} = require('../controllers/inviteController');
const { getRoomSnapshots, postRoomSnapshot } = require('../controllers/snapshotController');
const { protect } = require('../middleware/authMiddleware');
const socketHandler = require('../socket/socketHandler');

// Create a new private room (requires auth — creator becomes owner)
router.post('/create', protect, createRoom);

// Get rooms owned or joined by the current user
router.get('/owned', protect, getOwnedRooms);
router.get('/joined', protect, getJoinedRooms);
router.get('/user/my-rooms', protect, getUserRooms);

// Global Invitation & Notification routes
router.get('/notifications', protect, getNotificationsController);
router.get('/invitations/pending', protect, getPendingInvitations);
router.post('/invitations/accept', protect, acceptInvitation);
router.post('/invitations/reject', protect, rejectInvitation);
router.post('/invitations/:invitationId/accept', protect, acceptInvitation);
router.post('/invitations/:invitationId/reject', protect, rejectInvitation);

// Active rooms — which rooms have live connected users right now
router.get('/active-rooms', protect, (req, res) => {
  try {
    const active = socketHandler.getActiveRooms ? socketHandler.getActiveRooms() : {};
    return res.json({ success: true, activeRooms: active });
  } catch (err) {
    return res.json({ success: false, activeRooms: {} });
  }
});

// Check if room owner is currently online and connected
router.get('/:roomId/owner-status', protect, (req, res) => {
  try {
    const { roomId } = req.params;
    const isOwnerOnline = socketHandler.isOwnerOnline ? socketHandler.isOwnerOnline(roomId) : false;
    return res.json({ success: true, roomId, isOwnerOnline });
  } catch (err) {
    return res.json({ success: false, isOwnerOnline: false });
  }
});

// Delete room (owner only)
router.delete('/:roomId', protect, deleteRoomController);

// Leave room (member)
router.post('/:roomId/leave', protect, leaveRoomController);

// Room data routes (protected)
router.get('/:roomId', protect, getRoom);
router.post('/:roomId/save', protect, saveRoom);

// Access check (protected)
router.get('/:roomId/access', protect, checkAccess);

// Invite routes — owner only
router.post('/:roomId/invite', protect, inviteUser);
router.delete('/:roomId/invite/:username', protect, removeUser);

// Replay Snapshot routes (protected)
router.get('/:roomId/snapshots', protect, getRoomSnapshots);
router.post('/:roomId/snapshots', protect, postRoomSnapshot);

module.exports = router;
