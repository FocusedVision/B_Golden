const express = require('express');
const router = express.Router();
const GoogleMyBusiness = require('../services/GoogleMyBusiness');
const auth = require('../middleware/auth');
const gmbAuth = require('../middleware/gmbAuth');
const logger = require('../utils/logger');

// GMB Authorization routes
router.get('/auth/status', auth(), async (req, res) => {
    try {
        const hasAccess = await GoogleMyBusiness.checkAccess(req.user.id);
        res.json({ hasAccess });
    } catch (error) {
        logger.error('Failed to check GMB access status:', error);
        res.status(500).json({
            error: 'Failed to check GMB access status',
            details: error.message,
        });
    }
});

router.get('/auth/url', auth(), async (req, res) => {
    try {
        const authUrl = await GoogleMyBusiness.getAuthUrl(req.user.id);
        res.json({ authUrl });
    } catch (error) {
        logger.error('Failed to generate GMB auth URL:', error);
        res.status(500).json({
            error: 'Failed to generate GMB auth URL',
            details: error.message,
        });
    }
});

router.get('/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        await GoogleMyBusiness.handleAuthCallback(code, state);
        // res.redirect('/dashboard?gmb_connected=true');
    } catch (error) {
        logger.error('Failed to handle GMB auth callback:', error);
        res.redirect('/dashboard?gmb_error=true');
    }
});

// Get location reviews
router.get('/locations/:placeId/reviews', auth(), gmbAuth(), async (req, res) => {
    try {
        const reviews = await GoogleMyBusiness.getLocationReviews(req.params.placeId);
        res.json({ reviews });
    } catch (error) {
        logger.error('Failed to fetch reviews:', error);
        res.status(500).json({
            error: 'Failed to fetch reviews',
            details: error.message,
        });
    }
});

// Get location details
router.get('/locations/:placeId', auth(), gmbAuth(), async (req, res) => {
    try {
        const location = await GoogleMyBusiness.getLocationDetails(req.params.placeId);
        res.json(location);
    } catch (error) {
        logger.error('Failed to fetch location details:', error);
        res.status(500).json({
            error: 'Failed to fetch location details',
            details: error.message,
        });
    }
});

// Create review link
router.post('/locations/:placeId/review-link', auth(), gmbAuth(), async (req, res) => {
    try {
        const reviewUrl = await GoogleMyBusiness.createReviewLink(req.params.placeId);
        res.json({ reviewUrl });
    } catch (error) {
        logger.error('Failed to create review link:', error);
        res.status(500).json({
            error: 'Failed to create review link',
            details: error.message,
        });
    }
});

// Verify review exists
router.get('/locations/:placeId/verify-review', auth(), gmbAuth(), async (req, res) => {
    try {
        const { tenantEmail } = req.query;
        if (!tenantEmail) {
            return res.status(400).json({ error: 'Tenant email is required' });
        }

        const exists = await GoogleMyBusiness.verifyReviewExists(req.params.placeId, tenantEmail);
        res.json({ exists });
    } catch (error) {
        logger.error('Failed to verify review:', error);
        res.status(500).json({
            error: 'Failed to verify review',
            details: error.message,
        });
    }
});

// Get location insights
router.get('/locations/:placeId/insights', auth(), gmbAuth(), async (req, res) => {
    try {
        const insights = await GoogleMyBusiness.getLocationInsights(req.params.placeId);
        res.json(insights);
    } catch (error) {
        logger.error('Failed to fetch location insights:', error);
        res.status(500).json({
            error: 'Failed to fetch location insights',
            details: error.message,
        });
    }
});

// Respond to review
router.post(
    '/locations/:placeId/reviews/:reviewId/respond',
    auth(),
    gmbAuth(),
    async (req, res) => {
        try {
            const { comment } = req.body;
            if (!comment) {
                return res.status(400).json({ error: 'Response comment is required' });
            }

            await GoogleMyBusiness.respondToReview(
                req.params.placeId,
                req.params.reviewId,
                comment
            );
            res.json({ message: 'Review response posted successfully' });
        } catch (error) {
            logger.error('Failed to respond to review:', error);
            res.status(500).json({
                error: 'Failed to respond to review',
                details: error.message,
            });
        }
    }
);

// Get review metrics
router.get('/locations/:placeId/review-metrics', auth(), gmbAuth(), async (req, res) => {
    try {
        const metrics = await GoogleMyBusiness.getReviewMetrics(req.params.placeId);
        res.json(metrics);
    } catch (error) {
        logger.error('Failed to fetch review metrics:', error);
        res.status(500).json({
            error: 'Failed to fetch review metrics',
            details: error.message,
        });
    }
});

module.exports = router;
