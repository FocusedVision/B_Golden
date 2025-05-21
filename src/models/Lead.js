const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class Lead extends BaseModel {
    constructor() {
        super('leads');
    }

    async upsertMany(leads) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const lead of leads) {
                const columns = Object.keys(lead).join(', ');
                const values = Object.values(lead);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(lead)
                    .filter(key => key !== 'lead_id' && key !== 'updated_at')
                    .map(key => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (lead_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${leads.length} leads`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting leads:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Lead(); 