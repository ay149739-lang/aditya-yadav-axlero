const roomStorage = require('../utils/roomStorage');
const { findUserById } = require('./authController');
const { populateInvitedUsersDetails } = require('./inviteController');
const { v4: uuidv4 } = require('uuid');
const socketHandler = require('../socket/socketHandler');
const { captureSnapshot } = require('../services/snapshotService');

// POST /api/rooms/create — Creates a new private room owned by the authenticated user
const createRoom = async (req, res) => {
  try {
    const { roomName } = req.body;
    const userId = (req.user?._id || req.user?.id)?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roomName || !roomName.trim()) {
      return res.status(400).json({ success: false, message: 'Room name is required' });
    }

    // Generate a URL-friendly room ID from the name + short unique suffix
    const slug = roomName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const suffix = uuidv4().split('-')[0]; // e.g. "a1b2c3d4"
    const roomId = `${slug}-${suffix}`;

    // Create the room in storage — owner is User ID, initial member is owner User ID
    const room = await roomStorage.saveRoom(roomId, {
      roomName: roomName.trim(),
      owner: userId,
      members: [userId],
      pendingInvites: [],
      invitedUsers: [],
      accessRequests: [],
      isPublic: false,
      boardData: [],
      codeData: roomStorage.DEFAULT_CODE,
      language: 'javascript'
    });

    // Capture initial room baseline snapshot
    await captureSnapshot(roomId, {
      boardData: [],
      codeData: roomStorage.DEFAULT_CODE,
      language: 'javascript'
    });

    return res.status(201).json({
      success: true,
      message: `Room "${roomName.trim()}" created successfully`,
      roomId: room.roomId,
      roomName: roomName.trim(),
      owner: userId,
      ownerName: req.user?.name || req.user?.username || 'Owner',
      isPublic: false
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create room', error: error.message });
  }
};

// GET /api/rooms/:roomId
const getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    // Use same extraction pattern as all other controllers
    const userId = (req.user?._id || req.user?.id)?.toString();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const room = await roomStorage.getRoom(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    let ownerId = '';
    if (typeof room.owner === 'object' && room.owner !== null) {
      ownerId = (room.owner._id || room.owner.id || room.owner.username)?.toString().trim() || '';
    } else if (room.owner) {
      ownerId = room.owner.toString().trim();
    }

    if (!ownerId && Array.isArray(room.members) && room.members.length > 0) {
      const firstM = room.members[0];
      ownerId = (typeof firstM === 'object' && firstM !== null ? (firstM._id || firstM.id || firstM.username) : firstM)?.toString().trim() || '';
    }

    const userIdClean = userId.trim();
    const userUsername = (req.user?.username || req.user?.name || '').trim().toLowerCase();

    // --- Owner-first access logic ---
    // The room creator is ALWAYS granted access, regardless of invitation state.
    const isOwner = Boolean(
      (ownerId && ownerId === userIdClean) ||
      (ownerId && userUsername && ownerId.toLowerCase() === userUsername) ||
      (Array.isArray(room.members) && room.members.length > 0 && room.members[0]?.toString().trim() === userIdClean)
    );

    if (!isOwner) {
      // Non-owner: check membership, invited list, or public flag
      const members = (room.members || []).map(m => m.toString().trim());
      const invited = (room.invitedUsers || []).map(m => m.toString().trim());
      if (ownerId && !members.includes(ownerId)) members.push(ownerId);

      const isMember = members.some(m => m === userIdClean || m.toLowerCase() === userUsername) ||
                       invited.some(m => m === userIdClean || m.toLowerCase() === userUsername);

      if (!isMember && !room.isPublic) {
        console.log(`[getRoom] 403 — userId "${userIdClean}" / username "${userUsername}" is not owner ("${ownerId}") or member/invited of room "${roomId}"`);
        return res.status(403).json({
          success: false,
          message: 'You are not invited to this room.'
        });
      }

      // FIX 3: Enforce owner online validation for non-owners
      const isOwnerOnline = socketHandler.isOwnerOnline ? socketHandler.isOwnerOnline(roomId) : false;
      if (!isOwnerOnline) {
        return res.status(403).json({
          success: false,
          message: 'The room owner is currently offline. You can only join when the owner is inside the room.'
        });
      }
    }

    // Resolve owner display name for UI
    let ownerDisplayName = 'Owner';
    if (ownerId) {
      const ownerUser = await findUserById(ownerId);
      if (ownerUser) {
        ownerDisplayName = ownerUser.displayName || ownerUser.username;
      }
    }

    const invitedUsersDetails = await populateInvitedUsersDetails(room.invitedUsers || []);

    return res.status(200).json({
      success: true,
      roomId: room.roomId || roomId,
      roomName: room.roomName || room.roomId,
      owner: ownerId,
      ownerName: ownerDisplayName,
      members: room.members || [ownerId],
      invitedUsers: room.invitedUsers || [],
      invitedUsersDetails,
      pendingInvites: room.pendingInvites || [],
      isPublic: room.isPublic || false,
      boardData: room.boardData || [],
      codeData: room.codeData !== undefined ? room.codeData : roomStorage.DEFAULT_CODE,
      language: room.language || 'javascript',
      files: Array.isArray(room.files) ? room.files : [],
      activeFileId: room.activeFileId || null
    });
  } catch (error) {
    console.error('Error fetching room data:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch room data', error: error.message });
  }
};

// POST /api/rooms/:roomId/save
const saveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { boardData, codeData, language, files, activeFileId } = req.body;
    const userId = (req.user?._id || req.user?.id)?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const room = await roomStorage.getRoom(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const ownerId = room.owner ? room.owner.toString().trim() : null;
    const userIdClean = userId.trim();
    const userAlt = (req.user?.username || req.user?.name || '').trim();

    // Owner-first: owner can always save
    const isOwner = Boolean(
      (ownerId && ownerId === userIdClean) ||
      (ownerId && userAlt && ownerId === userAlt) ||
      (room.owner && req.user?._id && room.owner.toString() === req.user._id.toString())
    );

    if (!isOwner) {
      const members = (room.members || []).map(m => m.toString().trim());
      const invited = (room.invitedUsers || []).map(m => m.toString().trim());
      if (ownerId && !members.includes(ownerId)) members.push(ownerId);

      const isMember = members.includes(userIdClean) || invited.includes(userIdClean) || (userAlt && members.includes(userAlt));

      if (!isMember && !room.isPublic) {
        return res.status(403).json({
          success: false,
          message: 'You are not invited to this room.'
        });
      }
    }

    const updatedRoom = await roomStorage.saveRoom(roomId, { boardData, codeData, language, files, activeFileId });

    return res.status(200).json({
      success: true,
      message: 'Workspace saved successfully',
      room: updatedRoom
    });
  } catch (error) {
    console.error('Error saving room data:', error);
    return res.status(500).json({ success: false, message: 'Failed to save room data', error: error.message });
  }
};

// GET /api/rooms/owned — Get rooms owned by authenticated user
const getOwnedRooms = async (req, res) => {
  try {
    const userId = (req.user?._id || req.user?.id)?.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allRooms = await roomStorage.getAllRooms();
    const ownedRooms = [];

    for (const room of allRooms) {
      const ownerId = room.owner ? room.owner.toString() : null;
      if (ownerId === userId) {
        const members = (room.members || []).map(m => m.toString());
        ownedRooms.push({
          roomId: room.roomId,
          roomName: room.roomName || room.roomId,
          owner: ownerId,
          ownerName: req.user?.name || req.user?.username || 'Owner',
          membersCount: members.length,
          createdAt: room.createdAt || new Date(),
          updatedAt: room.updatedAt || new Date()
        });
      }
    }

    return res.status(200).json({ success: true, ownedRooms });
  } catch (error) {
    console.error('Error fetching owned rooms:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch owned rooms', error: error.message });
  }
};

// GET /api/rooms/joined — Get rooms joined by authenticated user (member but not owner)
const getJoinedRooms = async (req, res) => {
  try {
    const userId = (req.user?._id || req.user?.id)?.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allRooms = await roomStorage.getAllRooms();
    const joinedRooms = [];

    for (const room of allRooms) {
      const ownerId = room.owner ? room.owner.toString() : null;
      const members = (room.members || []).map(m => m.toString());

      if (members.includes(userId) && ownerId !== userId) {
        let ownerDisplayName = 'Owner';
        if (ownerId) {
          const ownerUser = await findUserById(ownerId);
          if (ownerUser) ownerDisplayName = ownerUser.displayName || ownerUser.username;
        }

        joinedRooms.push({
          roomId: room.roomId,
          roomName: room.roomName || room.roomId,
          owner: ownerId,
          ownerName: ownerDisplayName,
          membersCount: members.length,
          createdAt: room.createdAt || new Date(),
          updatedAt: room.updatedAt || new Date()
        });
      }
    }

    return res.status(200).json({ success: true, joinedRooms });
  } catch (error) {
    console.error('Error fetching joined rooms:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch joined rooms', error: error.message });
  }
};

// GET /api/rooms/user/my-rooms — Get rooms owned and joined by authenticated user
const getUserRooms = async (req, res) => {
  try {
    const userId = (req.user?._id || req.user?.id)?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allRooms = await roomStorage.getAllRooms();

    const ownedRooms = [];
    const joinedRooms = [];

    for (const room of allRooms) {
      const ownerId = room.owner ? room.owner.toString() : null;
      const members = (room.members || []).map(m => m.toString());

      let ownerDisplayName = 'Owner';
      if (ownerId) {
        const ownerUser = await findUserById(ownerId);
        if (ownerUser) ownerDisplayName = ownerUser.displayName || ownerUser.username;
      }

      const roomData = {
        roomId: room.roomId,
        roomName: room.roomName || room.roomId,
        owner: ownerId,
        ownerName: ownerDisplayName,
        membersCount: members.length,
        createdAt: room.createdAt || new Date(),
        updatedAt: room.updatedAt || new Date()
      };

      if (ownerId === userId) {
        ownedRooms.push(roomData);
      } else if (members.includes(userId)) {
        joinedRooms.push(roomData);
      }
    }

    return res.status(200).json({
      success: true,
      ownedRooms,
      joinedRooms
    });
  } catch (error) {
    console.error('Error fetching user rooms:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user rooms', error: error.message });
  }
};

// DELETE /api/rooms/:roomId — Delete room (Owner only)
const deleteRoomController = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = (req.user?._id || req.user?.id)?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const room = await roomStorage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const ownerId = room.owner ? room.owner.toString() : null;
    if (ownerId !== userId) {
      return res.status(403).json({ success: false, message: 'Only room owner can delete this room' });
    }

    await roomStorage.deleteRoom(roomId);

    return res.status(200).json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete room', error: error.message });
  }
};

// POST /api/rooms/:roomId/leave — Leave room (Member)
const leaveRoomController = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = (req.user?._id || req.user?.id)?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const room = await roomStorage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const members = (room.members || []).map(m => m.toString()).filter(m => m !== userId);
    const pendingInvites = (room.pendingInvites || []).map(m => m.toString()).filter(m => m !== userId);
    const invitedUsers = (room.invitedUsers || []).map(m => m.toString()).filter(m => m !== userId);

    await roomStorage.saveRoom(roomId, {
      members,
      pendingInvites,
      invitedUsers
    });

    // Remove user immediately from active socket room memory & broadcast updated list
    if (socketHandler && socketHandler.removeUserFromRoom) {
      socketHandler.removeUserFromRoom(roomId, userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    console.error('Error leaving room:', error);
    return res.status(500).json({ success: false, message: 'Failed to leave room', error: error.message });
  }
};

module.exports = {
  createRoom,
  getRoom,
  saveRoom,
  getUserRooms,
  getOwnedRooms,
  getJoinedRooms,
  deleteRoomController,
  leaveRoomController
};

