const { BigQuery } = require('@google-cloud/bigquery');
const Tenant = require('../models/Tenant');
const Facility = require('../models/Facility');
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
            // Sync tenant data
            const tenantQuery = `
                SELECT 
                    id,
                    facility_id,
                    name,
                    unit_number,
                    phone,
                    email,
                    move_in_date,
                    move_out_date,
                    is_good_standing,
                    notification_opt_in,
                    updated_at
                FROM \`${process.env.BIGQUERY_DATASET}.tenant_data\`
                WHERE updated_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
            `;

            const [tenantRows] = await this.bigquery.query({ query: tenantQuery });

            // Sync facility data
            const facilityQuery = `
                SELECT 
                    id,
                    name,
                    gmb_place_id,
                    gmb_link,
                    city,
                    state,
                    timezone,
                    context_notes,
                    updated_at
                FROM \`${process.env.BIGQUERY_DATASET}.facility_data\`
                WHERE updated_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
            `;

            const [facilityRows] = await this.bigquery.query({ query: facilityQuery });

            // Process tenant data
            for (const row of tenantRows) {
                const isGoodStanding = this.determineGoodStanding(row);
                const notificationOptIn = this.determineNotificationOptIn(row);

                const tenantData = {
                    facility_id: row.facility_id, // Facility ID
                    name: row.name, // Tenant Name
                    unit_number: row.unit_number, // Unit Number
                    phone: row.phone, // Phone Number
                    email: row.email, // Email Address
                    move_in_date: row.move_in_date, // Move In Date
                    move_out_date: row.move_out_date, // Move Out Date
                    is_good_standing: isGoodStanding, // Good Standing
                    notification_opt_in: notificationOptIn, // Notification Opt In
                    created_at: row.created_at, // Created At
                    updated_at: row.updated_at, // Updated At
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

            // Process facility data
            for (const row of facilityRows) {
                const facilityData = {
                    name: row.name, // Facility Name
                    gmb_place_id: row.gmb_place_id, // Google My Business Place ID
                    gmb_link: row.gmb_link, // Google My Business Link
                    city: row.city, // City
                    state: row.state, // State
                    timezone: row.timezone, // Timezone
                    context_notes: row.context_notes, // Context Notes
                    created_at: row.created_at, // Created At
                    updated_at: row.updated_at, // Updated At
                };

                // Check if facility exists
                const existingFacilities = await Facility.findAll({
                    id: row.facility_id,
                });

                if (existingFacilities.length > 0) {
                    await Facility.update(row.facility_id, facilityData);
                } else {
                    await Facility.create({
                        id: row.facility_id,
                        ...facilityData,
                    });
                }
            }

            logger.info(
                `Successfully synced ${tenantRows.length} tenant records and ${facilityRows.length} facility records`
            );
            return {
                tenants: tenantRows.length,
                facilities: facilityRows.length,
            };
        } catch (error) {
            logger.error('Error syncing data:', error);
            throw error;
        }
    }

    determineGoodStanding(tenant) {
        return tenant.payment_status === 'current' && !tenant.auction_status && tenant.balance <= 0;
    }

    determineNotificationOptIn(tenant) {
        return tenant.notification_preferences?.sms || tenant.notification_preferences?.email;
    }

    async getTenantHistory(tenantId) {
        try {
            const query = `
                SELECT 
                    *
                FROM \`${process.env.BIGQUERY_DATASET}.tenant_history\`
                WHERE tenant_id = @tenantId
                ORDER BY timestamp DESC
                LIMIT 100
            `;

            const options = {
                query,
                params: { tenantId },
            };

            const [rows] = await this.bigquery.query(options);
            return rows;
        } catch (error) {
            logger.error(`Error fetching tenant history for ${tenantId}:`, error);
            throw error;
        }
    }

    async getFacilityMetrics(facilityId) {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT tenant_id) as total_tenants,
                    COUNT(DISTINCT CASE WHEN payment_status = 'current' THEN tenant_id END) as active_tenants,
                    AVG(balance) as average_balance,
                    COUNT(DISTINCT CASE WHEN auction_status THEN tenant_id END) as auction_tenants
                FROM \`${process.env.BIGQUERY_DATASET}.tenant_data\`
                WHERE facility_id = @facilityId
            `;

            const options = {
                query,
                params: { facilityId },
            };

            const [rows] = await this.bigquery.query(options);
            return rows[0];
        } catch (error) {
            logger.error(`Error fetching facility metrics for ${facilityId}:`, error);
            throw error;
        }
    }

    async getDatasets() {
        try {
            // Get all datasets in the project
            const [datasets] = await this.bigquery.getDatasets();

            const datasetDetails = await Promise.all(
                datasets.map(async (dataset) => {
                    // Get tables in each dataset
                    const [tables] = await dataset.getTables();

                    return {
                        id: dataset.id,
                        name: dataset.id,
                        description: dataset.metadata?.description || '',
                        location: dataset.metadata?.location || '',
                        tables: tables.map((table) => ({
                            id: table.id,
                            name: table.id,
                            type: table.metadata?.type || 'TABLE',
                            creationTime: table.metadata?.creationTime,
                            lastModifiedTime: table.metadata?.lastModifiedTime,
                        })),
                    };
                })
            );

            return datasetDetails;
        } catch (error) {
            logger.error('Error fetching BigQuery datasets:', error);
            throw error;
        }
    }

    async getDatasetDetails(datasetId) {
        try {
            const dataset = this.bigquery.dataset(datasetId);
            const [metadata] = await dataset.getMetadata();
            const [tables] = await dataset.getTables();

            return {
                id: dataset.id,
                name: dataset.id,
                description: metadata.description || '',
                location: metadata.location || '',
                creationTime: metadata.creationTime,
                lastModifiedTime: metadata.lastModifiedTime,
                tables: tables.map((table) => ({
                    id: table.id,
                    name: table.id,
                    type: table.metadata?.type || 'TABLE',
                    creationTime: table.metadata?.creationTime,
                    lastModifiedTime: table.metadata?.lastModifiedTime,
                    schema: table.metadata?.schema || {},
                })),
            };
        } catch (error) {
            logger.error(`Error fetching details for dataset ${datasetId}:`, error);
            throw error;
        }
    }
}

module.exports = new BigQuerySync();
