const { BigQuery } = require('@google-cloud/bigquery');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

class BigQuerySync {
    constructor() {
        this.bigquery = new BigQuery({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
    }

    async syncTenantData() {
        try {
            const query = `
                SELECT 
                    tenant_id,
                    facility_id,
                    name,
                    unit_number,
                    phone,
                    email,
                    move_in_date,
                    move_out_date,
                    payment_status,
                    last_payment_date
                FROM \`${process.env.BIGQUERY_DATASET}.tenant_data\`
                WHERE last_updated >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
            `;

            const [rows] = await this.bigquery.query({ query });

            for (const row of rows) {
                const isGoodStanding = row.payment_status === 'current';

                // Update or create tenant record
                const tenantData = {
                    facility_id: row.facility_id,
                    name: row.name,
                    unit_number: row.unit_number,
                    phone: row.phone,
                    email: row.email,
                    move_in_date: row.move_in_date,
                    move_out_date: row.move_out_date,
                    is_good_standing: isGoodStanding,
                };

                // Check if tenant exists
                const existingTenants = await Tenant.findAll({
                    facility_id: row.facility_id,
                    unit_number: row.unit_number,
                });

                if (existingTenants.length > 0) {
                    await Tenant.update(existingTenants[0].id, tenantData);
                } else {
                    await Tenant.create(tenantData);
                }
            }

            logger.info(`Successfully synced ${rows.length} tenant records`);
            return rows.length;
        } catch (error) {
            logger.error('Error syncing tenant data:', error);
            throw error;
        }
    }
}

module.exports = new BigQuerySync();
