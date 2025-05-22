const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class UnitTurnover extends BaseModel {
    constructor() {
        super('unit_turnover');
    }

    async upsertMany(turnovers) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const turnover of turnovers) {
                const columns = Object.keys(turnover).join(', ');
                const values = Object.values(turnover);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(turnover)
                    .filter((key) => key !== 'id')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${turnovers.length} unit turnovers`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting unit turnovers:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new UnitTurnover();
