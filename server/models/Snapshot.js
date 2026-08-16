let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {
  // Mongoose fallback handled gracefully
}

if (mongoose) {
  const snapshotSchema = new mongoose.Schema({
    snapshotId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      default: '',
      index: true
    },
    userName: {
      type: String,
      default: ''
    },
    boardData: {
      type: Array,
      default: []
    },
    files: {
      type: Array,
      default: []
    },
    activeFileId: {
      type: String,
      default: null
    },
    codeData: {
      type: String,
      default: ''
    },
    language: {
      type: String,
      default: 'javascript'
    },
    executionOutput: {
      type: Object,
      default: null
    },
    actionType: {
      type: String,
      default: 'general'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  }, {
    timestamps: true
  });

  module.exports = mongoose.model('Snapshot', snapshotSchema);
} else {
  module.exports = null;
}
