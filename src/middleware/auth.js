const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const auth = (roles = []) => {
    return async (req, res, next) => {
        try {
            // Get token from header
            const token = req.header('Authorization')?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({ error: 'No authentication token provided' });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Add user to request object
            req.user = decoded;

            // Check role if roles are specified
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            logger.error('Authentication error:', error);

            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token' });
            }

            res.status(500).json({ error: 'Authentication failed' });
        }
    };
};

module.exports = auth;
