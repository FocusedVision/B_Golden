require('dotenv').config();
require('./routes/auth');
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const logger = require('./utils/logger');
const BigQuerySync = require('./services/BigQuerySync');
const cron = require('node-cron');

// Initialize express app
const app = express();


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Database health check
app.get('/health/db', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        logger.error('Database health check failed:', error);
        res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// Error handling middleware
app.use((err, req, res) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// Schedule BigQuery sync job
// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
    try {
        logger.info('Starting scheduled BigQuery sync...');
        const syncedCount = await BigQuerySync.syncTenantData();
        logger.info(`BigQuery sync completed. Synced ${syncedCount} records.`);
    } catch (error) {
        logger.error('Scheduled BigQuery sync failed:', error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle graceful shutdown
const shutdown = async () => {
    logger.info('Shutting down server...');
    
    // Stop all sync jobs
    syncScheduler.stopAllJobs();
    logger.info('Sync jobs stopped');
    
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
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown();
});
