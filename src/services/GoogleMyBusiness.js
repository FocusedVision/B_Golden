const { google } = require('googleapis');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const GmbCredentials = require('../models/GmbCredentials');

class GoogleMyBusiness {
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

    async initialize() {
        const startTime = Date.now();
        try {
            // If we have stored credentials, use them
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

            // Initialize the Google My Business API
            this.gmb = google.mybusinessaccountmanagement({
                version: 'v1',
                auth: this.client,
            });

            // Initialize the Google My Business API v4 for reviews and insights
            this.gmbV4 = google.mybusinessbusinessinformation({
                version: 'v1',
                auth: this.client,
            });

            logger.info('Google My Business API initialized successfully');
            metrics.trackApiCall('initialize', true, Date.now() - startTime);
        } catch (error) {
            metrics.trackApiCall('initialize', false, Date.now() - startTime);
            logger.error('Failed to initialize Google My Business API:', error);
            throw error;
        }
    }

    async getLocationReviews(placeId) {
        const startTime = Date.now();
        try {
            const response = await this.gmbV4.accounts.locations.reviews.list({
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

    async createReviewLink(placeId) {
        const startTime = Date.now();
        try {
            const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
            metrics.trackApiCall('createReviewLink', true, Date.now() - startTime);
            return reviewUrl;
        } catch (error) {
            metrics.trackApiCall('createReviewLink', false, Date.now() - startTime);
            logger.error(`Failed to create review link for location ${placeId}:`, error);
            throw error;
        }
    }

    async getLocationDetails(placeId) {
        const startTime = Date.now();
        try {
            const response = await this.gmbV4.accounts.locations.get({
                name: `locations/${placeId}`,
            });

            metrics.trackApiCall('getLocationDetails', true, Date.now() - startTime);
            return response.data;
        } catch (error) {
            metrics.trackApiCall('getLocationDetails', false, Date.now() - startTime);
            logger.error(`Failed to fetch location details for ${placeId}:`, error);
            throw error;
        }
    }

    async verifyReviewExists(placeId, tenantEmail) {
        const startTime = Date.now();
        try {
            const reviews = await this.getLocationReviews(placeId);
            const exists = reviews.some(
                (review) =>
                    review.reviewer.profilePhotoUrl &&
                    review.reviewer.profilePhotoUrl.includes(tenantEmail)
            );

            metrics.trackApiCall('verifyReviewExists', true, Date.now() - startTime);
            return exists;
        } catch (error) {
            metrics.trackApiCall('verifyReviewExists', false, Date.now() - startTime);
            logger.error(`Failed to verify review for ${placeId}:`, error);
            throw error;
        }
    }

    async getLocationInsights(placeId) {
        const startTime = Date.now();
        try {
            const response = await this.gmbV4.accounts.locations.reportInsights({
                name: `locations/${placeId}`,
                requestBody: {
                    basicRequest: {
                        metricRequests: [{ metric: 'ALL' }],
                        timeRange: {
                            startTime: new Date(
                                Date.now() - 30 * 24 * 60 * 60 * 1000
                            ).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    },
                },
            });

            metrics.trackApiCall('getLocationInsights', true, Date.now() - startTime);
            return response.data;
        } catch (error) {
            metrics.trackApiCall('getLocationInsights', false, Date.now() - startTime);
            logger.error(`Failed to fetch insights for location ${placeId}:`, error);
            throw error;
        }
    }

    async respondToReview(placeId, reviewId, comment) {
        const startTime = Date.now();
        try {
            await this.gmbV4.accounts.locations.reviews.updateReply({
                name: `locations/${placeId}/reviews/${reviewId}`,
                requestBody: {
                    comment: comment,
                },
            });

            metrics.trackApiCall('respondToReview', true, Date.now() - startTime);
        } catch (error) {
            metrics.trackApiCall('respondToReview', false, Date.now() - startTime);
            logger.error(`Failed to respond to review ${reviewId} for location ${placeId}:`, error);
            throw error;
        }
    }

    async getReviewMetrics(placeId) {
        const startTime = Date.now();
        try {
            const reviews = await this.getLocationReviews(placeId);

            const metrics = {
                total: reviews.length,
                averageRating: 0,
                ratingDistribution: {
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                },
                responseRate: 0,
                recentReviews: reviews.slice(0, 5),
            };

            let totalRating = 0;
            let respondedReviews = 0;

            reviews.forEach((review) => {
                const rating = review.starRating;
                metrics.ratingDistribution[rating]++;
                totalRating += rating;
                if (review.reply) {
                    respondedReviews++;
                }
            });

            metrics.averageRating = totalRating / reviews.length;
            metrics.responseRate = (respondedReviews / reviews.length) * 100;

            metrics.trackApiCall('getReviewMetrics', true, Date.now() - startTime);
            return metrics;
        } catch (error) {
            metrics.trackApiCall('getReviewMetrics', false, Date.now() - startTime);
            logger.error(`Failed to calculate review metrics for location ${placeId}:`, error);
            throw error;
        }
    }

    async syncLocationData(placeId) {
        const startTime = Date.now();
        try {
            const [location, reviews, insights] = await Promise.all([
                this.getLocationDetails(placeId),
                this.getLocationReviews(placeId),
                this.getLocationInsights(placeId),
            ]);

            const syncData = {
                location,
                reviews,
                insights,
                lastSynced: new Date().toISOString(),
            };

            metrics.trackApiCall('syncLocationData', true, Date.now() - startTime);
            return syncData;
        } catch (error) {
            metrics.trackApiCall('syncLocationData', false, Date.now() - startTime);
            logger.error(`Failed to sync data for location ${placeId}:`, error);
            throw error;
        }
    }

    async checkAccess(userId) {
        const startTime = Date.now();
        try {
            // Check if user has stored GMB credentials
            const hasCredentials = await this.getStoredCredentials(userId);
            if (!hasCredentials) {
                metrics.trackApiCall('checkAccess', false, Date.now() - startTime);
                return false;
            }

            // Verify credentials are still valid
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

    async getAuthUrl(userId) {
        const startTime = Date.now();
        try {
            const scopes = [
                'https://www.googleapis.com/auth/business.manage',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
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
            throw error;
        }
    }

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
            throw error;
        }
    }

    async getStoredCredentials(userId) {
        try {
            const credentials = await GmbCredentials.findByUserId(userId);
            if (!credentials) {
                return null;
            }

            // Check if token is expired
            if (GmbCredentials.isExpired(credentials.expiry_date)) {
                // Refresh token
                const newTokens = await this.refreshToken(credentials.refresh_token);
                if (!newTokens) {
                    return null;
                }

                // Store new tokens
                await GmbCredentials.upsert(userId, newTokens);
                return newTokens;
            }

            return credentials;
        } catch (error) {
            logger.error(`Failed to get stored credentials for user ${userId}:`, error);
            return null;
        }
    }

    async storeCredentials(userId, tokens) {
        const startTime = Date.now();
        try {
            const credentials = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type,
                expiry_date: new Date(tokens.expiry_date)
            };

            await GmbCredentials.upsert(userId, credentials);
            metrics.trackApiCall('storeCredentials', true, Date.now() - startTime);
            logger.info(`Stored GMB credentials for user ${userId}`);
        } catch (error) {
            metrics.trackApiCall('storeCredentials', false, Date.now() - startTime);
            logger.error(`Failed to store credentials for user ${userId}:`, error);
            throw error;
        }
    }
}

module.exports = new GoogleMyBusiness();
