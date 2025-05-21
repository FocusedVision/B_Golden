const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class CustomerTouch extends BaseModel {
    constructor() {
        super('customer_touches');
    }

    async upsertMany(touches) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const touch of touches) {
                const columns = Object.keys(touch).join(', ');
                const values = Object.values(touch);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(touch)
                    .filter(key => key !== 'ga_session' && key !== 'updated_at')
                    .map(key => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (ga_session) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${touches.length} customer touches`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting customer touches:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new CustomerTouch(); 