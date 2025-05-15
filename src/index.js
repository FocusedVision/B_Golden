require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const { logger, requestLogger } = require('./utils/logger');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');

// Create Express app
const app = express();

// Global rate limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const PORT = process.env.PORT || 3000;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(globalLimiter);

// API routes
app.use('/api/auth', authRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

async function startServer() {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        logger.info('Database connection successful');

        // Start the server
        const server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });

        // Graceful shutdown handler
        const shutdown = async () => {
            logger.info('Shutting down server...');
            
            server.close(async () => {
                try {
                    await pool.end();
                    logger.info('Database connections closed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error('Could not close connections in time, forcing shutdown');
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer();