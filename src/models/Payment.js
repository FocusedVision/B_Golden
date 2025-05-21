const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class Payment extends BaseModel {
    constructor() {
        super('payments');
    }

    async upsertMany(payments) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const payment of payments) {
                const columns = Object.keys(payment).join(', ');
                const values = Object.values(payment);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(payment)
                    .filter(key => key !== 'payment_id')
                    .map(key => `${key} = EXCLUDED.${key}`)
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
            logger.info(`Successfully upserted ${payments.length} payments`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting payments:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Payment(); 