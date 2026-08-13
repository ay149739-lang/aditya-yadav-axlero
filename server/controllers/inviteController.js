const roomStorage = require('../utils/roomStorage');
const invitationStorage = require('../utils/invitationStorage');
const { searchUserByQuery, findUserById } = require('./authController');

/**
 * Helper to authoritatively determine if the authenticated user is the room owner.
 * Evaluates against authenticated user session (ID, ObjectId, username) and
 * falls back to checking room creator (first member) to handle serialization edge cases.
 */
const checkIsRoomOwner = (room, reqUser) => {
  if (!room || !reqUser) return false;

  const currentUserId = (reqUser._id || reqUser.id)?.toString().trim();
  const currentUsername = (reqUser.username || reqUser.name || '').toString().trim().toLowerCase();

  let roomOwnerId = null;
  if (typeof room.owner === 'object' && room.owner !== null) {
    roomOwnerId = (room.owner._id || room.owner.id || room.owner.username)?.toString().trim();
  } else if (room.owner) {
    roomOwnerId = room.owner.toString().trim();
  }

  const roomOwnerClean = roomOwnerId ? roomOwnerId.toLowerCase() : null;

  // 1. Direct ID match
  if (currentUserId && roomOwnerId && currentUserId === roomOwnerId) {
    return true;
  }

  // 2. Mongoose ObjectId / string equality
  if (room.owner && reqUser._id) {
    const rawOwnerStr = (typeof room.owner === 'object' && room.owner !== null)
      ? (room.owner._id || room.owner.id)?.toString()
      : room.owner.toString();
    if (rawOwnerStr && rawOwnerStr === reqUser._id.toString()) {
      return true;
    }
  }

  // 3. Username match (case insensitive)
  if (currentUsername && roomOwnerClean && currentUsername === roomOwnerClean) {
    return true;
  }

  // 4. Room Creator / First Member fallback
  const members = Array.isArray(room.members) ? room.members.map(m => {
    if (typeof m === 'object' && m !== null) {
      return (m._id || m.id || m.username)?.toString().trim();
    }
    return m ? m.toString().trim() : '';
  }) : [];

  if (members.length > 0) {
    const creator = members[0];
    if (currentUserId && creator === currentUserId) {
      return true;
    }
    if (currentUsername && creator.toLowerCase() === currentUsername) {
      return true;
    }
  }

  return false;
};

// POST /api/rooms/:roomId/invite — Owner invites a user (by username or email)
const inviteUser = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { username } = req.body; // can be username or email

    const currentUserId = (req.user?._id || req.user?.id)?.toString().trim();

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username or email is required' });
    }

    const room = await roomStorage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const isOwner = checkIsRoomOwner(room, req.user);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only owner can invite' });
    }

    // Look up target user by username or email
    const targetUser = await searchUserByQuery(username.trim());
    if (!targetUser) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const targetUserId = targetUser.id.toString();

    // Validation: Owner cannot invite themselves (by User ID)
    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot invite yourself' });
    }

    // Validation: Verify user is not already a member (by User ID)
    const roomMembers = (room.members || []).map(m => m.toString());
    if (roomMembers.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: 'User already joined' });
    }

    // Validation: Verify user is not already invited (by User ID)
    const pendingInvites = (room.pendingInvites || []).map(m => m.toString());
    const invitedUsers = (room.invitedUsers || []).map(m => m.toString());
    const existingPending = await invitationStorage.findPendingInvitation(roomId, targetUserId);

    if (existingPending || pendingInvites.includes(targetUserId) || invitedUsers.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: 'User already invited' });
    }

    // Create invitation record using User IDs
    const invitation = await invitationStorage.createInvitation({
      roomId,
      roomName: room.roomName || roomId,
      ownerId: currentUserId,
      ownerName: req.user?.name || req.user?.username || 'Owner',
      invitedUserId: targetUserId,
      invitedUsername: targetUser.username || 'User'
    });

    // Update Room pendingInvites & invitedUsers with User IDs
    const updatedPending = Array.from(new Set([...pendingInvites, targetUserId]));
    const updatedInvited = Array.from(new Set([...invitedUsers, targetUserId]));

    const updatedRoom = await roomStorage.saveRoom(roomId, {
      pendingInvites: updatedPending,
      invitedUsers: updatedInvited
    });

    return res.status(200).json({
      success: true,
      message: 'Invitation Sent',
      invitation: {
        ...invitation,
        invitedUsername: targetUser.username,
        invitedDisplayName: targetUser.displayName
      },
      owner: updatedRoom.owner,
      invitedUsers: updatedRoom.invitedUsers,
      pendingInvites: updatedRoom.pendingInvites
    });
  } catch (error) {
    console.error('Invite error:', error);
    return res.status(500).json({ success: false, message: 'Failed to invite user', error: error.message });
  }
};

// GET /api/notifications (or /api/rooms/invitations/pending)
const getNotificationsController = async (req, res) => {
  try {
    const currentUserId = (req.user?._id || req.user?.id)?.toString();
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const data = await invitationStorage.getAllInvitationsForUser(currentUserId);

    return res.status(200).json({
      success: true,
      unreadCount: data.pending.length,
      pending: data.pending,
      accepted: data.accepted,
      rejected: data.rejected,
      invitations: data.pending
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// GET /api/rooms/invitations/pending — Fetch all pending invitations for logged-in user
const getPendingInvitations = async (req, res) => {
  try {
    const currentUserId = (req.user?._id || req.user?.id)?.toString();
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const invitations = await invitationStorage.getPendingInvitationsForUser(currentUserId);

    return res.status(200).json({ success: true, invitations });
  } catch (error) {
    console.error('Fetch pending invitations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending invitations' });
  }
};

// POST /api/invitations/accept OR /api/rooms/invitations/:invitationId/accept
const acceptInvitation = async (req, res) => {
  try {
    const invitationId = req.params.invitationId || req.body.invitationId;
    const currentUserId = (req.user?._id || req.user?.id)?.toString();

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!invitationId) {
      return res.status(400).json({ success: false, message: 'Invitation ID is required' });
    }

    const invitation = await invitationStorage.getInvitationById(invitationId);
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.invitedUser.toString() !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this invitation' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Invitation is already ${invitation.status}` });
    }

    // Add user ID to room members and remove from pendingInvites
    const room = await roomStorage.getRoom(invitation.roomId);
    if (room) {
      const currentMembers = (room.members || []).map(m => m.toString());
      const updatedMembers = Array.from(new Set([...currentMembers, currentUserId]));
      const updatedPending = (room.pendingInvites || []).map(m => m.toString()).filter(u => u !== currentUserId);

      await roomStorage.saveRoom(invitation.roomId, {
        members: updatedMembers,
        pendingInvites: updatedPending
      });
    }

    const updatedInv = await invitationStorage.updateInvitationStatus(invitationId, 'accepted');

    return res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      invitation: updatedInv,
      roomId: invitation.roomId
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to accept invitation' });
  }
};

// POST /api/invitations/reject OR /api/rooms/invitations/:invitationId/reject
const rejectInvitation = async (req, res) => {
  try {
    const invitationId = req.params.invitationId || req.body.invitationId;
    const currentUserId = (req.user?._id || req.user?.id)?.toString();

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!invitationId) {
      return res.status(400).json({ success: false, message: 'Invitation ID is required' });
    }

    const invitation = await invitationStorage.getInvitationById(invitationId);
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.invitedUser.toString() !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this invitation' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Invitation is already ${invitation.status}` });
    }

    // Remove user ID from room pendingInvites
    const room = await roomStorage.getRoom(invitation.roomId);
    if (room) {
      const updatedPending = (room.pendingInvites || []).map(m => m.toString()).filter(u => u !== currentUserId);
      await roomStorage.saveRoom(invitation.roomId, { pendingInvites: updatedPending });
    }

    const updatedInv = await invitationStorage.updateInvitationStatus(invitationId, 'declined');

    return res.status(200).json({ success: true, message: 'Invitation declined', invitation: updatedInv });
  } catch (error) {
    console.error('Reject invitation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject invitation' });
  }
};

// DELETE /api/rooms/:roomId/invite/:username — Revoke invitation / access by User ID or username
const removeUser = async (req, res) => {
  try {
    const { roomId, username: targetParam } = req.params;
    const currentUserId = (req.user?._id || req.user?.id)?.toString().trim();

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const room = await roomStorage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const isOwner = checkIsRoomOwner(room, req.user);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only the room owner can remove access' });
    }

    // targetParam might be username or user ID — resolve to user ID
    let targetUserId = targetParam;
    if (!targetParam.match(/^[a-f\d]{24}$/i) && !targetParam.match(/^[0-9a-f-]{36}$/i)) {
      const targetUser = await searchUserByQuery(targetParam);
      if (targetUser) targetUserId = targetUser.id.toString();
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot remove yourself as owner' });
    }

    const updatedInvites = (room.invitedUsers || [])
      .map(m => m.toString())
      .filter(u => u !== targetUserId && u.toLowerCase() !== targetParam.toLowerCase());
    const updatedPending = (room.pendingInvites || [])
      .map(m => m.toString())
      .filter(u => u !== targetUserId && u.toLowerCase() !== targetParam.toLowerCase());
    const updatedMembers = (room.members || [])
      .map(m => m.toString())
      .filter(u => u !== targetUserId && u.toLowerCase() !== targetParam.toLowerCase());

    // Ensure owner is preserved in members list
    const roomOwnerId = room.owner ? room.owner.toString().trim() : (room.members?.[0] ? room.members[0].toString().trim() : currentUserId);
    if (roomOwnerId && !updatedMembers.includes(roomOwnerId)) {
      updatedMembers.unshift(roomOwnerId);
    }

    const updatedRoom = await roomStorage.saveRoom(roomId, {
      invitedUsers: updatedInvites,
      pendingInvites: updatedPending,
      members: updatedMembers
    });

    return res.status(200).json({
      success: true,
      message: 'Access revoked',
      owner: updatedRoom.owner,
      invitedUsers: updatedRoom.invitedUsers,
      members: updatedRoom.members
    });
  } catch (error) {
    console.error('Remove access error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove user access', error: error.message });
  }
};

// GET /api/rooms/:roomId/access — Check access status for current user
const checkAccess = async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUserId = (req.user?._id || req.user?.id)?.toString().trim();

    const room = await roomStorage.getRoom(roomId);

    if (!room || !room.owner) {
      return res.status(403).json({ success: false, hasAccess: false, message: 'You are not invited to this room.' });
    }

    const ownerId = room.owner.toString();
    const members = (room.members || []).map(m => m.toString());
    if (ownerId && !members.includes(ownerId)) members.unshift(ownerId);

    const isOwner = checkIsRoomOwner(room, req.user);
    const isMember = Boolean(currentUserId && (members.includes(currentUserId) || (req.user?.username && members.some(m => m.toLowerCase() === req.user.username.toLowerCase()))));
    const hasAccess = isOwner || isMember || room.isPublic;

    // Resolve owner display name
    let ownerDisplayName = 'Owner';
    const ownerUser = await findUserById(ownerId);
    if (ownerUser) ownerDisplayName = ownerUser.displayName || ownerUser.username;

    return res.status(hasAccess ? 200 : 403).json({
      success: hasAccess,
      hasAccess,
      owner: ownerId,
      ownerName: ownerDisplayName,
      roomName: room.roomName || roomId,
      isOwner,
      isMember,
      invitedUsers: room.invitedUsers || [],
      members: room.members || [],
      pendingInvites: room.pendingInvites || [],
      message: hasAccess ? 'Access granted' : 'You are not invited to this room.'
    });
  } catch (error) {
    console.error('Check access error:', error);
    return res.status(500).json({ success: false, hasAccess: false, message: 'Failed to verify room access' });
  }
};

module.exports = {
  inviteUser,
  getPendingInvitations,
  getNotificationsController,
  acceptInvitation,
  rejectInvitation,
  removeUser,
  checkAccess
};
