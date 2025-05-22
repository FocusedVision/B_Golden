const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class Unit extends BaseModel {
    constructor() {
        super('units');
    }

    async upsertMany(units) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const unit of units) {
                const columns = Object.keys(unit).join(', ');
                const values = Object.values(unit);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(unit)
                    .filter((key) => key !== 'unit_id')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (unit_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${units.length} units`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting units:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Unit();
