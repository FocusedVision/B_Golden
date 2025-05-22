const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class GAEvent extends BaseModel {
    constructor() {
        super('ga_events');
    }

    async upsertMany(events) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const event of events) {
                const columns = Object.keys(event).join(', ');
                const values = Object.values(event);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(event)
                    .filter((key) => key !== 'ga_session_id')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (ga_session_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${events.length} GA events`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting GA events:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new GAEvent();
