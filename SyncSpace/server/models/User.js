let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {
  // Mongoose fallback handled gracefully
}

if (mongoose) {
  const userSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    displayName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: '#6366F1'
    },
    recoveryCodeHash: {
      type: String,
      required: true
    }
  }, {
    timestamps: true
  });

  module.exports = mongoose.model('User', userSchema);
} else {
  module.exports = null;
}
