const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class Contact extends BaseModel {
    constructor() {
        super('contacts');
    }

    async upsertMany(contacts) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const contact of contacts) {
                const columns = Object.keys(contact).join(', ');
                const values = Object.values(contact);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                const updateClause = Object.keys(contact)
                    .filter((key) => key !== 'contact_id' && key !== 'updated_at')
                    .map((key) => `${key} = EXCLUDED.${key}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${this.tableName} (${columns})
                    VALUES (${placeholders})
                    ON CONFLICT (contact_id) 
                    DO UPDATE SET 
                        ${updateClause},
                        updated_at = CURRENT_TIMESTAMP
                `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            logger.info(`Successfully upserted ${contacts.length} contacts`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error upserting contacts:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Contact();
