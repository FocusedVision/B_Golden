const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class Lease extends BaseModel {
    constructor() {
        super('leases');
    }

    async upsertMany(leases) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const lease of leases) {
                const columns = Object.keys(lease).join(', ');
                const values = Object.values(lease);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(lease)
                    .filter((key) => key !== 'lease_id')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (lease_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${leases.length} leases`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting leases:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Lease();
