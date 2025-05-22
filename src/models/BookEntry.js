const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class BookEntry extends BaseModel {
    constructor() {
        super('book_entries');
    }

    async upsertMany(entries) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const entry of entries) {
                const columns = Object.keys(entry).join(', ');
                const values = Object.values(entry);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(entry)
                    .filter((key) => key !== 'txn_id')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (txn_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${entries.length} book entries`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting book entries:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new BookEntry();
