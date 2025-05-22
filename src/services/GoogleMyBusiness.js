const { google } = require('googleapis');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const GmbCredentials = require('../models/GmbCredentials');

/**
 * GoogleMyBusiness service for interacting with Google My Business API
 * Handles authentication, account management, and location operations
 */
class GoogleMyBusiness {
    /**
     * Initialize GoogleMyBusiness service with required credentials
     */
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/business.manage'],
        });
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    /**
     * Initialize Google My Business API clients
     * @throws {Error} If initialization fails
     */
    async initialize() {
        const startTime = Date.now();
        try {
            if (this.userId) {
                const tokens = await this.getStoredCredentials(this.userId);
                if (tokens) {
                    this.oauth2Client.setCredentials(tokens);
                    this.client = this.oauth2Client;
                } else {
                    this.client = await this.auth.getClient();
                }
            } else {
                this.client = await this.auth.getClient();
            }

            this.gmbManagement = google.mybusinessaccountmanagement({
                version: 'v1',
                auth: this.client,
            });

            this.gmbInfo = google.mybusinessbusinessinformation({
                version: 'v1',
                auth: this.client,
            });

            this.gmbProfile = google.businessprofileperformance({
                version: 'v1',
                auth: this.client,
            });

            logger.info('Google My Business API initialized successfully');
            metrics.trackApiCall('initialize', true, Date.now() - startTime);
        } catch (error) {
            metrics.trackApiCall('initialize', false, Date.now() - startTime);
            logger.error('Failed to initialize Google My Business API:', error);
            throw new Error(`Failed to initialize GMB API: ${error.message}`);
        }
    }

    /**
     * Retrieve stored GMB credentials for a user
     * @param {string} userId - The user's ID
     * @returns {Promise<Object|null>} The stored credentials or null if not found
     */
    async getStoredCredentials(userId) {
        try {
            const credentials = await GmbCredentials.findByUserId(userId);
            if (!credentials) {
                return null;
            }

            if (GmbCredentials.isExpired(credentials.expiry_date)) {
                const newTokens = await this.refreshToken(credentials.refresh_token);
                if (!newTokens) {
                    return null;
                }
                await GmbCredentials.upsert(userId, newTokens);
                return newTokens;
            }

            return credentials;
        } catch (error) {
            logger.error(`Failed to get stored credentials for user ${userId}:`, error);
            return null;
        }
    }

    /**
     * Store GMB credentials for a user
     * @param {string} userId - The user's ID
     * @param {Object} tokens - The OAuth tokens
     * @throws {Error} If storing credentials fails
     */
    async storeCredentials(userId, tokens) {
        const startTime = Date.now();
        try {
            const credentials = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type,
                expiry_date: new Date(tokens.expiry_date),
            };

            await GmbCredentials.upsert(userId, credentials);
            metrics.trackApiCall('storeCredentials', true, Date.now() - startTime);
            logger.info(`Stored GMB credentials for user ${userId}`);
        } catch (error) {
            metrics.trackApiCall('storeCredentials', false, Date.now() - startTime);
            logger.error(`Failed to store credentials for user ${userId}:`, error);
            throw new Error(`Failed to store GMB credentials: ${error.message}`);
        }
    }

    /**
     * Get GMB account ID for the authenticated user
     * @returns {Promise<string>} The account ID
     * @throws {Error} If no accounts found or API call fails
     */
    async getAccountId() {
        const startTime = Date.now();
        try {
            const response = await this.gmbManagement.accounts.list();

            if (!response.data.accounts?.length) {
                throw new Error('No GMB accounts found');
            }
            const accountId = response.data.accounts[0].name.split('/')[1];
            metrics.trackApiCall('getAccountId', true, Date.now() - startTime);
            return accountId;
        } catch (error) {
            metrics.trackApiCall('getAccountId', false, Date.now() - startTime);
            logger.error('Failed to get GMB account ID:', error);
            throw new Error(`Failed to get GMB account ID: ${error.message}`);
        }
    }

    /**
     * Check if user has valid GMB access
     * @param {string} userId - The user's ID
     * @returns {Promise<boolean>} Whether the user has valid GMB access
     */
    async checkAccess(userId) {
        const startTime = Date.now();
        try {
            const hasCredentials = await this.getStoredCredentials(userId);
            if (!hasCredentials) {
                metrics.trackApiCall('checkAccess', false, Date.now() - startTime);
                return false;
            }

            try {
                await this.initialize();
                metrics.trackApiCall('checkAccess', true, Date.now() - startTime);
                return true;
            } catch (error) {
                metrics.trackApiCall('checkAccess', false, Date.now() - startTime);
                return false;
            }
        } catch (error) {
            metrics.trackApiCall('checkAccess', false, Date.now() - startTime);
            logger.error(`Failed to check GMB access for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Generate GMB authentication URL
     * @param {string} userId - The user's ID
     * @returns {Promise<string>} The authentication URL
     * @throws {Error} If URL generation fails
     */
    async getAuthUrl(userId) {
        const startTime = Date.now();
        try {
            const scopes = [
                'https://www.googleapis.com/auth/business.manage',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/plus.business.manage',
            ];

            const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                state,
                prompt: 'consent',
            });

            metrics.trackApiCall('getAuthUrl', true, Date.now() - startTime);
            return authUrl;
        } catch (error) {
            metrics.trackApiCall('getAuthUrl', false, Date.now() - startTime);
            logger.error(`Failed to generate auth URL for user ${userId}:`, error);
            throw new Error(`Failed to generate GMB auth URL: ${error.message}`);
        }
    }

    /**
     * Handle GMB authentication callback
     * @param {string} code - The authorization code
     * @param {string} state - The state parameter
     * @returns {Promise<boolean>} Whether the callback was handled successfully
     * @throws {Error} If callback handling fails
     */
    async handleAuthCallback(code, state) {
        const startTime = Date.now();
        try {
            const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
            const { tokens } = await this.oauth2Client.getToken(code);
            await this.storeCredentials(userId, tokens);
            metrics.trackApiCall('handleAuthCallback', true, Date.now() - startTime);
            return true;
        } catch (error) {
            metrics.trackApiCall('handleAuthCallback', false, Date.now() - startTime);
            logger.error('Failed to handle auth callback:', error);
            throw new Error(`Failed to handle GMB auth callback: ${error.message}`);
        }
    }

    /**
     * Get location details for a specific place
     * @param {string} placeId - The Google Place ID
     * @returns {Promise<Object>} The location details
     * @throws {Error} If location details cannot be fetched
     */
    async getLocationDetails(placeId) {
        const startTime = Date.now();
        try {
            const accountId = await this.getAccountId();
            const response = await this.gmbInfo.accounts.locations.get({
                name: `accounts/${accountId}/locations/${placeId}`,
            });

            metrics.trackApiCall('getLocationDetails', true, Date.now() - startTime);
            return response.data;
        } catch (error) {
            metrics.trackApiCall('getLocationDetails', false, Date.now() - startTime);
            logger.error(`Failed to fetch location details for ${placeId}:`, error);
            throw new Error(`Failed to fetch location details: ${error.message}`);
        }
    }

    /**
     * Get reviews for a specific location
     * @param {string} placeId - The Google Place ID
     * @returns {Promise<Array>} The reviews
     * @throws {Error} If reviews cannot be fetched
     */
    async getLocationReviews(placeId) {
        const startTime = Date.now();
        try {
            const response = await this.gmbInfo.accounts.locations.reviews.list({
                parent: `locations/${placeId}`,
                pageSize: 100,
                orderBy: 'createTime desc',
            });

            metrics.trackApiCall('getLocationReviews', true, Date.now() - startTime);
            return response.data.reviews || [];
        } catch (error) {
            metrics.trackApiCall('getLocationReviews', false, Date.now() - startTime);
            logger.error(`Failed to fetch reviews for location ${placeId}:`, error);
            throw error;
        }
    }
}

module.exports = new GoogleMyBusiness();
