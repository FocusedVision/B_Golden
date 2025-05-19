const express = require('express');
const router = express.Router();
const CubbyPMS = require('../services/CubbyPMS');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Webhook endpoint for Cubby PMS events
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-cubby-signature'];

        // Verify webhook signature
        if (!signature || !verifyWebhookSignature(signature, req.body)) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        await CubbyPMS.handleWebhook(req.body);
        res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
        logger.error('Webhook processing failed:', error);
        res.status(500).json({ error: 'Failed to process webhook' });
    }
});

// Manual sync endpoints (protected by authentication)
router.post('/sync/facilities', auth(), async (req, res) => {
    try {
        const result = await CubbyPMS.syncFacilities();
        res.json({
            message: 'Facility sync completed',
            details: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                total: result.total
            }
        });
    } catch (error) {
        logger.error('Facility sync failed:', error);
        res.status(500).json({ 
            error: 'Failed to sync facilities',
            details: error.message
        });
    }
});

router.post('/sync/tenants/:facilityId', auth(), async (req, res) => {
    try {
        const result = await CubbyPMS.syncTenants(req.params.facilityId);
        res.json({
            message: 'Tenant sync completed',
            details: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                total: result.total
            }
        });
    } catch (error) {
        logger.error('Tenant sync failed:', error);
        res.status(500).json({ 
            error: 'Failed to sync tenants',
            details: error.message
        });
    }
});

// Get tenant details
router.get('/tenants/:tenantId', auth(), async (req, res) => {
    try {
        const tenant = await CubbyPMS.getTenantDetails(req.params.tenantId);
        res.json(tenant);
    } catch (error) {
        logger.error('Failed to get tenant details:', error);
        res.status(500).json({ 
            error: 'Failed to get tenant details',
            details: error.message
        });
    }
});

// Get facility details
router.get('/facilities/:facilityId', auth(), async (req, res) => {
    try {
        const facility = await CubbyPMS.getFacilityDetails(req.params.facilityId);
        res.json(facility);
    } catch (error) {
        logger.error('Failed to get facility details:', error);
        res.status(500).json({ 
            error: 'Failed to get facility details',
            details: error.message
        });
    }
});

// Metrics endpoints (protected by authentication)
router.get('/metrics', auth(), async (req, res) => {
    try {
        const metricsData = metrics.getMetrics();
        res.json(metricsData);
    } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({ 
            error: 'Failed to get metrics',
            details: error.message
        });
    }
});

router.get('/health', auth(), async (req, res) => {
    try {
        const healthStatus = metrics.getHealthStatus();
        res.json(healthStatus);
    } catch (error) {
        logger.error('Failed to get health status:', error);
        res.status(500).json({ 
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

// Helper function to verify webhook signature
function verifyWebhookSignature(signature, payload) {
    const crypto = require('crypto');
    const secret = process.env.CUBBY_WEBHOOK_SECRET;

    const hmac = crypto.createHmac('sha256', secret);
    const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));
}

module.exports = router;
