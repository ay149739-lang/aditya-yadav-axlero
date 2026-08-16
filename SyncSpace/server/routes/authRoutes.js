const express = require('express');
const router = express.Router();
const { register, login, getMe, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

module.exports = router;
