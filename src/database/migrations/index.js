require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/database');

async function runMigrations() {
    try {
        // Create migrations table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Read and execute schema.sql
        const schemaPath = path.join(__dirname, '../schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

        // Split the schema into individual statements
        const statements = schemaSQL
            .split(';')
            .map((statement) => statement.trim())
            .filter((statement) => statement.length > 0);

        // Execute each statement
        for (const statement of statements) {
            await pool.query(statement);
        }

        console.log('Migrations completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();

module.exports = runMigrations;
