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
    boardData: {
      type: Array,
      default: []
    },
    codeData: {
      type: String,
      default: ''
    },
    language: {
      type: String,
      default: 'javascript'
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
