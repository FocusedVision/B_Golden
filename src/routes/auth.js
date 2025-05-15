const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */

router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role = 'staff' } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        // Check if email already exists
        const {
            rows: [existingUser],
        } = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered',
            });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const {
            rows: [newUser],
        } = await db.query(
            `
            INSERT INTO users (
                email,
                password_hash,
                first_name,
                last_name,
                role,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, first_name, last_name, role
        `,
            [email, passwordHash, firstName, lastName, role, 'active']
        );

        // Create JWT token
        const token = jwt.sign(
            {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '24h' }
        );

        res.status(201).json({
            success: true,
            data: {
                token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    role: newUser.role,
                },
            },
        });
    } catch (error) {
        logger.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user',
        });
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

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        // Get user from database
        const {
            rows: [user],
        } = await db.query('SELECT * FROM users WHERE email = $1 AND status = $2', [
            email,
            'active',
        ]);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        // Create JWT token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRY || '24h',
        });

        // Update last login
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                },
            },
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to login',
        });
    }
});

module.exports = router;
