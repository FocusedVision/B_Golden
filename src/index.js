require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const logger = require('./utils/logger');
const BigQuerySync = require('./services/BigQuerySync');
const CubbyPMS = require('./services/CubbyPMS');
const cron = require('node-cron');
const authRoutes = require('./routes/auth');
const cubbyRoutes = require('./routes/cubby');
const gmbRoutes = require('./routes/gmb');

// Initialize express app
const app = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/cubby', cubbyRoutes);
app.use('/gmb', gmbRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Database health check
app.get('/health/db', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Database health check failed:', error);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

// Initialize services
async function initializeServices() {
    try {
        // await CubbyPMS.initialize();
        logger.info('All services initialized successfully');
    } catch (error) {
        logger.error('Service initialization failed:', error);
        process.exit(1);
    }
}

// Schedule BigQuery sync job
// Run every day at every midnight
cron.schedule(process.env.BIGQUERY_SYNC_SCHEDULE || '0 0 * * *', async () => {
    try {
        logger.info('Starting scheduled BigQuery sync...');
        const syncedCount = await BigQuerySync.syncTenantData();
        logger.info(
            `BigQuery sync completed. Synced Tenants: ${syncedCount.tenants} and Facilities: ${syncedCount.facilities} records.`
        );
    } catch (error) {
        logger.error('Scheduled BigQuery sync failed:', error);
    }
});

// Schedule Cubby PMS sync job
// Run every 6 hours
cron.schedule(process.env.CUBBY_SYNC_SCHEDULE || '0 */6 * * *', async () => {
    try {
        logger.info('Starting scheduled Cubby PMS sync...');
        const facilityCount = await CubbyPMS.syncFacilities();
        logger.info(`Cubby PMS sync completed. Synced ${facilityCount} facilities.`);
    } catch (error) {
        logger.error('Scheduled Cubby PMS sync failed:', error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await initializeServices();
    logger.info(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received. Starting graceful shutdown...');
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
});

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
