/**
 * Main application entry point
 * @module src/index
 */

require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { scheduleJob } = require('node-schedule');
const cron = require('node-cron');

// Application dependencies
const { pool } = require('./config/database');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const BigQuerySync = require('./services/BigQuerySync');
// const CubbyPMS = require('./services/CubbyPMS');

// Route handlers
const authRoutes = require('./routes/auth');
const gmbRoutes = require('./routes/gmb');
// const cubbyRoutes = require('./routes/cubby');

// Configuration
const PORT = process.env.PORT || 3000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;
const CUBBY_SYNC_SCHEDULE = process.env.CUBBY_SYNC_SCHEDULE || '0 */6 * * *';

/**
 * Initialize Express application with middleware and configuration
 * @returns {express.Application} Configured Express application
 */
function createApp() {
    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    // Rate limiting
    const limiter = rateLimit({
        windowMs: RATE_LIMIT_WINDOW_MS,
        max: RATE_LIMIT_MAX_REQUESTS,
        message: 'Too many requests from this IP, please try again later',
    });
    app.use(limiter);

    // Request logging and metrics
    app.use((req, res, next) => {
        const startTime = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            metrics.trackApiCall(req.path, res.statusCode < 400, duration);
            logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
        });
        next();
    });

    // API routes
    app.use('/auth', authRoutes);
    // app.use('/cubby', cubbyRoutes);
    app.use('/gmb', gmbRoutes);

    // Health check endpoints
    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    app.get('/health/db', async (req, res) => {
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok' });
        } catch (error) {
            logger.error('Database health check failed:', error);
            res.status(500).json({
                status: 'error',
                message: 'Database connection failed',
            });
        }
    });

    // Error handling middleware
    app.use((err, req, res) => {
        logger.error('Unhandled error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    });

    return app;
}

/**
 * Initialize application services
 * @returns {Promise<void>}
 */
async function initializeServices() {
    try {
        // await CubbyPMS.initialize();
        logger.info('All services initialized successfully');
    } catch (error) {
        logger.error('Service initialization failed:', error);
        process.exit(1);
    }
}

/**
 * Schedule BigQuery data refresh jobs
 */
function scheduleBigQueryJobs() {
    // Unit occupancy refresh - hourly
    scheduleJob('0 * * * *', async () => {
        const jobName = 'unit occupancy refresh';
        logger.info(`Starting scheduled ${jobName}...`);
        try {
            const units = await BigQuerySync.getUnits();
            logger.info(`Successfully completed ${jobName} for ${units.length} units`);
        } catch (error) {
            logger.error(`Failed to complete ${jobName}:`, {
                error: error.message,
                stack: error.stack,
            });
        }
    });

    // Payment data refresh - every 6 hours
    scheduleJob('0 */6 * * *', async () => {
        const jobName = 'payment data refresh';
        logger.info(`Starting scheduled ${jobName}...`);
        try {
            const payments = await BigQuerySync.getPayments({ days: 7 });
            logger.info(`Successfully completed ${jobName} for ${payments.length} recent payments`);
        } catch (error) {
            logger.error(`Failed to complete ${jobName}:`, {
                error: error.message,
                stack: error.stack,
            });
        }
    });

    // Customer interactions refresh - daily
    scheduleJob('0 0 * * *', async () => {
        const jobName = 'customer interactions refresh';
        logger.info(`Starting scheduled ${jobName}...`);
        try {
            const touches = await BigQuerySync.getCustomerTouches({ days: 1 });
            logger.info(
                `Successfully completed ${jobName} for ${touches.length} customer interactions`
            );
        } catch (error) {
            logger.error(`Failed to complete ${jobName}:`, {
                error: error.message,
                stack: error.stack,
            });
        }
    });

    // Book entries refresh - every 12 hours
    scheduleJob('* */12 * * *', async () => {
        const jobName = 'book entries refresh';
        logger.info(`Starting scheduled ${jobName}...`);
        try {
            const entries = await BigQuerySync.getBookEntries({ days: 7 });
            logger.info(`Successfully completed ${jobName} for ${entries.length} book entries`);
        } catch (error) {
            logger.error(`Failed to complete ${jobName}:`, {
                error: error.message,
                stack: error.stack,
            });
        }
    });

    // Contact information refresh - daily
    scheduleJob('0 1 * * *', async () => {
        try {
            logger.info('Starting scheduled contact information refresh...');
            const contacts = await BigQuerySync.getContacts();
            logger.info(`Refreshed data for ${contacts.length} contacts`);
        } catch (error) {
            logger.error('Failed to refresh contact information:', error);
        }
    });

    // Google Analytics events refresh - every 4 hours
    scheduleJob('0 */4 * * *', async () => {
        try {
            logger.info('Starting scheduled GA events refresh...');
            const events = await BigQuerySync.getGAEvents({ days: 1 });
            logger.info(`Refreshed data for ${events.length} GA events`);
        } catch (error) {
            logger.error('Failed to refresh GA events:', error);
        }
    });

    // Leads refresh - every 6 hours
    scheduleJob('0 */6 * * *', async () => {
        try {
            logger.info('Starting scheduled leads refresh...');
            const leads = await BigQuerySync.getLeads({ days: 7 });
            logger.info(`Refreshed data for ${leads.length} leads`);
        } catch (error) {
            logger.error('Failed to refresh leads:', error);
        }
    });

    // Leases refresh - every 12 hours
    scheduleJob('0 */12 * * *', async () => {
        try {
            logger.info('Starting scheduled leases refresh...');
            const leases = await BigQuerySync.getLeases();
            logger.info(`Refreshed data for ${leases.length} leases`);
        } catch (error) {
            logger.error('Failed to refresh leases:', error);
        }
    });

    // Managers refresh - daily
    scheduleJob('0 2 * * *', async () => {
        try {
            logger.info('Starting scheduled managers refresh...');
            const managers = await BigQuerySync.getManagers();
            logger.info(`Refreshed data for ${managers.length} managers`);
        } catch (error) {
            logger.error('Failed to refresh managers:', error);
        }
    });

    // Pricing groups refresh - daily
    scheduleJob('0 3 * * *', async () => {
        try {
            logger.info('Starting scheduled pricing groups refresh...');
            const groups = await BigQuerySync.getPricingGroups();
            logger.info(`Refreshed data for ${groups.length} pricing groups`);
        } catch (error) {
            logger.error('Failed to refresh pricing groups:', error);
        }
    });

    // Spaces historical data refresh - daily
    scheduleJob('0 4 * * *', async () => {
        try {
            logger.info('Starting scheduled spaces historical data refresh...');
            const spaces = await BigQuerySync.getSpacesHistorical({ days: 30 });
            logger.info(`Refreshed data for ${spaces.length} historical spaces`);
        } catch (error) {
            logger.error('Failed to refresh spaces historical data:', error);
        }
    });

    // Unit turnover refresh - daily
    scheduleJob('0 5 * * *', async () => {
        try {
            logger.info('Starting scheduled unit turnover refresh...');
            const turnovers = await BigQuerySync.getUnitTurnover({ days: 30 });
            logger.info(`Refreshed data for ${turnovers.length} unit turnovers`);
        } catch (error) {
            logger.error('Failed to refresh unit turnover:', error);
        }
    });
}

/**
 * Schedule Cubby PMS sync job
 */
function scheduleCubbySync() {
    cron.schedule(CUBBY_SYNC_SCHEDULE, async () => {
        try {
            logger.info('Starting scheduled Cubby PMS sync...');
            // const facilityCount = await CubbyPMS.syncFacilities();
            logger.info(`Cubby PMS sync completed. Synced facilities.`);
        } catch (error) {
            logger.error('Scheduled Cubby PMS sync failed:', error);
        }
    });
}

// Initialize application
const app = createApp();

// Start scheduled jobs
scheduleBigQueryJobs();
scheduleCubbySync();

// Start server
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

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', {
        reason: reason.message || reason,
        stack: reason.stack,
        timestamp: new Date().toISOString(),
    });
    process.exit(1);
});
