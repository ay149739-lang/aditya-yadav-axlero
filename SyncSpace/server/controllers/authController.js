const crypto = require('crypto');
const User = require('../models/User');
const { signToken, hashPassword, verifyPassword } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// In-memory fallback user storage if MongoDB is not connected
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const usersMap = new Map();
let isFileLoaded = false;

const loadUsersFromFile = () => {
  if (isFileLoaded) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf8');
      if (content.trim()) {
        const data = JSON.parse(content);
        for (const [key, val] of Object.entries(data)) {
          usersMap.set(key, val);
        }
      }
    }
    isFileLoaded = true;
  } catch (err) {
    console.error('Error loading users from file:', err);
    isFileLoaded = true;
  }
};

const saveUsersToFile = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj = {};
    for (const [k, v] of usersMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users to file:', err);
  }
};

const generateRecoveryCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const getBlock = (len) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      let randVal = Math.floor(Math.random() * chars.length);
      try {
        if (crypto && typeof crypto.randomBytes === 'function') {
          const buf = crypto.randomBytes(1);
          if (buf && buf.length > 0) {
            randVal = buf[0] % chars.length;
          }
        }
      } catch (e) {
        randVal = Math.floor(Math.random() * chars.length);
      }
      res += chars[randVal];
    }
    return res;
  };
  return `SYNC-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}`;
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const name = displayName?.trim() || username.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : `${cleanUsername}@syncspace.io`;
    const color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;

    loadUsersFromFile();

    let existingUser = null;

    // Check MongoDB if available
    if (User && User.db && User.db.readyState === 1) {
      existingUser = await User.findOne({
        $or: [{ username: cleanUsername }, { email: cleanEmail }]
      });
    } else {
      existingUser = usersMap.get(cleanUsername);
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username or email is already taken'
      });
    }

    const passwordHash = hashPassword(password);
    const recoveryCode = generateRecoveryCode();
    const recoveryCodeHash = hashPassword(recoveryCode);
    const userId = uuidv4();

    let savedUserData = {
      id: userId,
      _id: userId,
      username: cleanUsername,
      displayName: name,
      email: cleanEmail,
      passwordHash,
      recoveryCodeHash,
      color
    };

    if (User && User.db && User.db.readyState === 1) {
      const newUser = await User.create({
        username: cleanUsername,
        displayName: name,
        email: cleanEmail,
        passwordHash,
        recoveryCodeHash,
        color
      });
      savedUserData.id = newUser._id.toString();
      savedUserData._id = newUser._id.toString();
    }

    // Always update local cache & JSON backup
    usersMap.set(cleanUsername, savedUserData);
    if (cleanEmail) usersMap.set(cleanEmail, savedUserData);
    usersMap.set(savedUserData.id, savedUserData);
    saveUsersToFile();

    const tokenPayload = {
      id: savedUserData.id,
      username: cleanUsername,
      name,
      email: cleanEmail,
      color
    };

    const token = signToken(tokenPayload);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: savedUserData.id,
        username: cleanUsername,
        name,
        email: cleanEmail,
        color
      },
      recoveryCode
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const cleanInput = username.trim().toLowerCase();

    loadUsersFromFile();

    let userData = null;

    if (User && User.db && User.db.readyState === 1) {
      const dbUser = await User.findOne({
        $or: [{ username: cleanInput }, { email: cleanInput }]
      });
      if (dbUser) {
        userData = {
          id: dbUser._id.toString(),
          username: dbUser.username,
          displayName: dbUser.displayName,
          email: dbUser.email || `${dbUser.username}@syncspace.io`,
          passwordHash: dbUser.passwordHash,
          color: dbUser.color
        };
      }
    }

    if (!userData && usersMap.has(cleanInput)) {
      userData = usersMap.get(cleanInput);
    }

    if (!userData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const isMatch = verifyPassword(password, userData.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const tokenPayload = {
      id: userData.id,
      username: userData.username,
      name: userData.displayName || userData.username,
      email: userData.email,
      color: userData.color || '#6366F1'
    };

    const token = signToken(tokenPayload);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: userData.id,
        username: userData.username,
        name: userData.displayName || userData.username,
        email: userData.email,
        color: userData.color || '#6366F1'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        email: req.user.email,
        color: req.user.color
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current user'
    });
  }
};

// Search user by email or username
const searchUserByQuery = async (query) => {
  if (!query || !query.trim()) return null;
  const cleanQuery = query.trim().toLowerCase();
  loadUsersFromFile();

  if (User && User.db && User.db.readyState === 1) {
    try {
      const dbUser = await User.findOne({
        $or: [{ username: cleanQuery }, { email: cleanQuery }]
      });
      if (dbUser) {
        return {
          id: dbUser._id.toString(),
          _id: dbUser._id.toString(),
          username: dbUser.username,
          displayName: dbUser.displayName,
          email: dbUser.email
        };
      }
    } catch (err) {
      console.error('searchUserByQuery MongoDB error:', err);
    }
  }

  for (const userVal of usersMap.values()) {
    if (userVal.username === cleanQuery || userVal.email === cleanQuery) {
      return {
        id: userVal.id || userVal._id,
        _id: userVal.id || userVal._id,
        username: userVal.username,
        displayName: userVal.displayName,
        email: userVal.email
      };
    }
  }

  return null;
};

// Helper: Find user details by User ID
const findUserById = async (userId) => {
  if (!userId) return null;
  const idStr = userId.toString();
  loadUsersFromFile();

  if (User && User.db && User.db.readyState === 1) {
    try {
      const dbUser = await User.findById(idStr);
      if (dbUser) {
        return {
          id: dbUser._id.toString(),
          _id: dbUser._id.toString(),
          username: dbUser.username,
          displayName: dbUser.displayName,
          email: dbUser.email
        };
      }
    } catch (err) {
      // ignore invalid ObjectId format for mock IDs
    }
  }

  for (const u of usersMap.values()) {
    if (u.id === idStr || u._id === idStr) {
      return {
        id: u.id || u._id,
        _id: u.id || u._id,
        username: u.username,
        displayName: u.displayName,
        email: u.email
      };
    }
  }

  return null;
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { identifier, recoveryCode, newPassword } = req.body;

    if (!identifier || !recoveryCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery credentials.'
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanCode = recoveryCode.trim();

    if (!cleanIdentifier || !cleanCode || !newPassword.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery credentials.'
      });
    }

    loadUsersFromFile();

    let userRecord = null;

    if (User && User.db && User.db.readyState === 1) {
      const dbUser = await User.findOne({
        $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }]
      });
      if (dbUser) {
        userRecord = dbUser;
      }
    }

    if (!userRecord && usersMap.has(cleanIdentifier)) {
      userRecord = usersMap.get(cleanIdentifier);
    }

    if (!userRecord || (!userRecord.recoveryCodeHash && !userRecord.recoveryHash)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery credentials.'
      });
    }

    const storedRecoveryHash = userRecord.recoveryCodeHash || userRecord.recoveryHash;
    const isCodeMatch = verifyPassword(cleanCode, storedRecoveryHash);

    if (!isCodeMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery credentials.'
      });
    }

    const newPasswordHash = hashPassword(newPassword);

    if (User && User.db && User.db.readyState === 1 && userRecord._id) {
      await User.findByIdAndUpdate(userRecord._id, { passwordHash: newPasswordHash });
    }

    const id = userRecord.id || userRecord._id?.toString();
    if (userRecord.username) {
      const existingInMap = usersMap.get(userRecord.username) || userRecord;
      existingInMap.passwordHash = newPasswordHash;
      usersMap.set(userRecord.username, existingInMap);
      if (existingInMap.email) usersMap.set(existingInMap.email, existingInMap);
      if (id) usersMap.set(id, existingInMap);
    }
    saveUsersToFile();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'Password reset failed',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  resetPassword,
  searchUserByQuery,
  findUserById
};

