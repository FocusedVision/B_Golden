const BigQuerySync = require('../services/BigQuerySync');
const logger = require('../utils/logger');

async function inspectTables() {
    try {
        const datasetName = 'authorized_views';
        logger.info(`\nInspecting dataset: ${datasetName}`);

        // Get dataset details
        const datasetDetails = await BigQuerySync.getDatasetDetails(datasetName);

        // List all available views
        logger.info('\nAvailable views:');
        datasetDetails.tables.forEach((table) => {
            logger.info(`- ${table.name} (${table.type})`);
            logger.info(`  Created: ${new Date(parseInt(table.creationTime)).toLocaleString()}`);
        });

        // Get sample data from key views
        const views = [
            'units', // Current unit information
            'leases', // Lease agreements
            'payments', // Payment records
            'customer_touches', // Customer interactions
        ];

        for (const view of views) {
            logger.info(`\nInspecting view: ${view}`);

            // Get view schema
            const viewDetails = datasetDetails.tables.find((t) => t.name === view);
            if (viewDetails) {
                logger.info('View schema:', viewDetails.schema);
            }

            // Get sample data
            const query = `
                SELECT *
                FROM \`${datasetName}.${view}\`
                LIMIT 5
            `;

            try {
                const [rows] = await BigQuerySync.bigquery.query({ query });
                logger.info(`Sample data from ${view}:`, rows);
            } catch (error) {
                logger.error(`Error querying ${view}:`, error.message);
            }
        }
    } catch (error) {
        logger.error('Error inspecting tables:', error);
        throw error;
    }
}

// Run the inspection
inspectTables().catch(console.error);
