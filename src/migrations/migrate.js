require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../config/db');
const { logger } = require('../utils/logger');
const bcrypt = require('bcrypt');

async function migrate() {
    const client = await pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');

         // Read and execute schema.sql
         const schemaPath = path.join(__dirname, 'schema.sql');
         const schemaSql = await fs.readFile(schemaPath, 'utf8');
         
         logger.info('Applying database migrations...');
         await client.query(schemaSql);

          // Create triggers for all tables that need updated_at
        const tables = [
            'users',
        ];

        for (const table of tables) {
            await client.query(`
                CREATE TRIGGER update_${table}_updated_at
                    BEFORE UPDATE ON ${table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `);
        }

        // Insert example data
        logger.info('Inserting example data...');

        // Example User
        const saltRounds = 10; // Or a value from your config
        const plainPassword = '123456';
        const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);

        await client.query(
            "INSERT INTO users (email, password_hash, first_name, last_name, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            ['yevhenii.kotov@goldenreputation.io', hashedPassword, 'Yevhenii', 'Kotov', 'admin', 'active']
        );

        logger.info('Example data inserted successfully.');

        // Commit transaction
        await client.query('COMMIT');
        logger.info('Database migration completed successfully');
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrate().then(() => {
        logger.info('Migration completed');
        process.exit(0);
    }).catch((error) => {
        logger.error('Migration failed:', error);
        process.exit(1);
    });
}

module.exports = migrate; 