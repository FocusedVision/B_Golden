const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class GmbCredentials extends BaseModel {
    constructor() {
        super('gmb_credentials');
    }

    async findByUserId(userId) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM gmb_credentials WHERE user_id = $1',
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding GMB credentials:', error);
            throw error;
        }
    }

    async upsert(userId, credentials) {
        try {
            const result = await this.pool.query(
                `INSERT INTO gmb_credentials 
                (user_id, access_token, refresh_token, scope, token_type, expiry_date)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    access_token = $2,
                    refresh_token = $3,
                    scope = $4,
                    token_type = $5,
                    expiry_date = $6,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    userId,
                    credentials.access_token,
                    credentials.refresh_token,
                    credentials.scope,
                    credentials.token_type,
                    credentials.expiry_date,
                ]
            );
            return result.rows[0];
        } catch (error) {
            logger.error('Error upserting GMB credentials:', error);
            throw error;
        }
    }

    async deleteByUserId(userId) {
        try {
            await this.pool.query('DELETE FROM gmb_credentials WHERE user_id = $1', [userId]);
        } catch (error) {
            logger.error('Error deleting GMB credentials:', error);
            throw error;
        }
    }

    isExpired(expiryDate) {
        return new Date(expiryDate) <= new Date();
    }
}

module.exports = new GmbCredentials();
