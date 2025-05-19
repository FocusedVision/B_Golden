const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */

router.post('/register', async (req, res) => {
    try {
        console.log('Registering a new user');
        const { email, password, firstName, lastName, role = 'staff' } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const result = await User.createUser({
            email,
            password,
            first_name: firstName,
            last_name: lastName,
            role,
        });

        res.status(201).json(result);
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * @route POST /api/auth/login
 * @desc Login user and get token
 * @access Public
 */

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await User.authenticate(email, password);

        // Update last login
        await User.updateLastLogin(result.user.id);

        res.json(result);
    } catch (error) {
        logger.error('Login error:', error);
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Change password
router.post('/change-password', auth(), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await User.updatePassword(req.user.id, currentPassword, newPassword);
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        logger.error('Password change error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get current user
router.get('/me', auth(), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove sensitive data
        const { ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        logger.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

module.exports = router;
