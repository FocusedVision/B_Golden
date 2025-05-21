const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class Manager extends BaseModel {
    constructor() {
        super('managers');
    }

    async upsertMany(managers) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const manager of managers) {
                const columns = Object.keys(manager).join(', ');
                const values = Object.values(manager);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(manager)
                    .filter(key => key !== 'manager_id')
                    .map(key => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (manager_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${managers.length} managers`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting managers:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Manager(); 