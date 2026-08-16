let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {
  // Mongoose fallback handled gracefully
}

if (mongoose) {
  const roomSchema = new mongoose.Schema({
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    roomName: {
      type: String,
      default: ''
    },
    owner: {
      type: String,
      default: null,
      index: true
    },
    members: {
      type: [String],
      default: []
    },
    pendingInvites: {
      type: [String],
      default: []
    },
    invitedUsers: {
      type: [String],
      default: []
    },
    accessRequests: {
      type: [String],
      default: []
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    boardData: {
      type: Array,
      default: []
    },
    codeData: {
      type: String,
      default: `// Collaborative Workspace Editor\nfunction syncSpace() {\n  console.log("Realtime collaboration ready!");\n}\n\nsyncSpace();`
    },
    language: {
      type: String,
      default: 'javascript'
    }
  }, {
    timestamps: true
  });

  module.exports = mongoose.model('Room', roomSchema);
} else {
  module.exports = null;
}
