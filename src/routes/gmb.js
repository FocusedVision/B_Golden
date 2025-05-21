const express = require('express');
const router = express.Router();
const GoogleMyBusiness = require('../services/GoogleMyBusiness');
const auth = require('../middleware/auth');
const gmbAuth = require('../middleware/gmbAuth');
const logger = require('../utils/logger');

/**
 * Get Google My Business authentication URL
 * @route GET /gmb/auth/url
 * @access Private
 */
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

/**
 * Handle Google My Business authentication callback
 * @route GET /gmb/auth/callback
 * @access Public
 */
router.get('/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).json({
                error: 'Missing required parameters',
                details: 'Both code and state parameters are required',
            });
        }

        await GoogleMyBusiness.handleAuthCallback(code, state);
        // res.redirect('/dashboard?gmb_connected=true');
    } catch (error) {
        logger.error('Failed to handle GMB auth callback:', error);
        res.redirect('/dashboard?gmb_error=true');
    }
});

/**
 * Get location details for a specific place
 * @route GET /gmb/locations/:placeId
 * @access Private
 */
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

/**
 * Get reviews for a specific location
 * @route GET /gmb/locations/:placeId/reviews
 * @access Private
 */
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

module.exports = router;
