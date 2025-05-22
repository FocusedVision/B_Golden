const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class SpaceHistorical extends BaseModel {
    constructor() {
        super('spaces_historical');
    }

    async upsertMany(spaces) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const space of spaces) {
                const columns = Object.keys(space).join(', ');
                const values = Object.values(space);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(space)
                    .filter((key) => key !== 'id')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (org_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${spaces.length} historical spaces`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting historical spaces:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new SpaceHistorical();
