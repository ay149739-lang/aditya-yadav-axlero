const { getSnapshots, captureSnapshot } = require('../services/snapshotService');

// GET /api/rooms/:roomId/snapshots
const getRoomSnapshots = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId)?.toString() : null;
    const snapshots = await getSnapshots(roomId, userId);

    return res.status(200).json({
      success: true,
      count: snapshots.length,
      snapshots
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch room replay timeline',
      error: error.message
    });
  }
};

// POST /api/rooms/:roomId/snapshots
const postRoomSnapshot = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id || req.user.userId)?.toString() : '';
    const userName = req.user ? (req.user.name || req.user.username) : '';
    const { boardData, files, activeFileId, codeData, language, executionOutput, actionType } = req.body;

    const snapshot = await captureSnapshot(roomId, {
      userId,
      userName,
      boardData,
      files,
      activeFileId,
      codeData,
      language,
      executionOutput,
      actionType
    });

    return res.status(201).json({
      success: true,
      snapshot
    });
  } catch (error) {
    console.error('Error capturing snapshot:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create room snapshot',
      error: error.message
    });
  }
};

module.exports = {
  getRoomSnapshots,
  postRoomSnapshot
};
