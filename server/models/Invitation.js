let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {
  // Mongoose fallback handled gracefully
}

if (mongoose) {
  const invitationSchema = new mongoose.Schema({
    roomId: {
      type: String,
      required: true,
      index: true
    },
    roomName: {
      type: String,
      required: true
    },
    owner: {
      type: String, // MongoDB User _id string
      required: true,
      index: true
    },
    ownerName: {
      type: String,
      default: ''
    },
    invitedUser: {
      type: String, // MongoDB User _id string
      required: true,
      index: true
    },
    invitedUsername: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'declined'],
      default: 'pending',
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    declinedAt: {
      type: Date,
      default: null
    }
  }, {
    timestamps: true
  });

  module.exports = mongoose.model('Invitation', invitationSchema);
} else {
  module.exports = null;
}
