const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class PricingGroup extends BaseModel {
    constructor() {
        super('pricing_group');
    }

    async upsertMany(groups) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const group of groups) {
                const columns = Object.keys(group).join(', ');
                const values = Object.values(group);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(group)
                    .filter(key => key !== 'pg_id')
                    .map(key => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (pg_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${groups.length} pricing groups`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting pricing groups:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new PricingGroup(); 