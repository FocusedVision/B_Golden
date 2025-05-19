const { google } = require('googleapis');
const logger = require('../utils/logger');

class GoogleMyBusiness {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/business.manage'],
        });
    }

    async initialize() {
        try {
            this.client = await this.auth.getClient();
            this.gmb = google.mybusiness({
                version: 'v4',
                auth: this.client,
            });
            logger.info('Google My Business API initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Google My Business API:', error);
            throw error;
        }
    }

    async getLocationReviews(placeId) {
        try {
            const response = await this.gmb.accounts.locations.reviews.list({
                parent: `locations/${placeId}`,
                pageSize: 100,
                orderBy: 'createTime desc',
            });

            return response.data.reviews || [];
        } catch (error) {
            logger.error(`Failed to fetch reviews for location ${placeId}:`, error);
            throw error;
        }
    }

    async createReviewLink(placeId) {
        try {
            // Generate a review link using the Place ID
            const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
            return reviewUrl;
        } catch (error) {
            logger.error(`Failed to create review link for location ${placeId}:`, error);
            throw error;
        }
    }

    async getLocationDetails(placeId) {
        try {
            const response = await this.gmb.accounts.locations.get({
                name: `locations/${placeId}`,
            });

            return response.data;
        } catch (error) {
            logger.error(`Failed to fetch location details for ${placeId}:`, error);
            throw error;
        }
    }

    async verifyReviewExists(placeId, tenantEmail) {
        try {
            const reviews = await this.getLocationReviews(placeId);

            // Check if any review matches the tenant's email
            return reviews.some(
                (review) =>
                    review.reviewer.profilePhotoUrl &&
                    review.reviewer.profilePhotoUrl.includes(tenantEmail)
            );
        } catch (error) {
            logger.error(`Failed to verify review for ${placeId}:`, error);
            throw error;
        }
    }
}

module.exports = new GoogleMyBusiness();
