const { BigQuery } = require('@google-cloud/bigquery');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

class BigQuerySync {
    constructor() {
        this.bigquery = new BigQuery({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        this.datasetName = 'authorized_views';
        this.batchSize = parseInt(process.env.BIGQUERY_SYNC_BATCH_SIZE || '1000', 10);
    }

    /**
     * Get all available views in the dataset
     * @returns {Promise<Array>} List of views
     */
    async getViews() {
        const startTime = Date.now();
        try {
            const [views] = await this.bigquery.dataset(this.datasetName).getTables();
            metrics.trackApiCall('getViews', true, Date.now() - startTime);
            return views;
        } catch (error) {
            metrics.trackApiCall('getViews', false, Date.now() - startTime);
            logger.error('Failed to get views:', error);
            throw error;
        }
    }

    /**
     * Get book entries (matches schema)
     */
    async getBookEntries(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.book_entries\`
                WHERE 1=1
                ${options.facility ? 'AND facility = @facility' : ''}
                ${options.startDate ? 'AND entry_date_time >= @startDate' : ''}
                ${options.endDate ? 'AND entry_date_time <= @endDate' : ''}
                ORDER BY entry_date_time DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    facility: options.facility,
                    startDate: options.startDate,
                    endDate: options.endDate,
                },
            });
            metrics.trackApiCall('getBookEntries', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getBookEntries', false, Date.now() - startTime);
            logger.error('Failed to get book entries:', error);
            throw error;
        }
    }

    /**
     * Get contacts (matches schema)
     */
    async getContacts(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.contacts\`
                ${options.contact_id ? 'WHERE contact_id = @contact_id' : ''}
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    contact_id: options.contact_id,
                },
            });
            metrics.trackApiCall('getContacts', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getContacts', false, Date.now() - startTime);
            logger.error('Failed to get contacts:', error);
            throw error;
        }
    }

    /**
     * Get customer touches (matches schema)
     */
    async getCustomerTouches(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.customer_touches\`
                WHERE 1=1
                ${options.contact_id ? 'AND contact_id = @contact_id' : ''}
                ${options.lease_id ? 'AND lease_id = @lease_id' : ''}
                ${options.lead_id ? 'AND lead_id = @lead_id' : ''}
                ${options.ga_session ? 'AND ga_session = @ga_session' : ''}
                ${options.days ? 'AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)' : ''}
                ORDER BY created_at DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    contact_id: options.contact_id,
                    lease_id: options.lease_id,
                    lead_id: options.lead_id,
                    ga_session: options.ga_session,
                    days: options.days || 30,
                },
            });
            metrics.trackApiCall('getCustomerTouches', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getCustomerTouches', false, Date.now() - startTime);
            logger.error('Failed to get customer touches:', error);
            throw error;
        }
    }

    /**
     * Get Google Analytics events (matches schema)
     */
    async getGAEvents(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.ga_events\`
                WHERE 1=1
                ${options.org_id ? 'AND org_id = @org_id' : ''}
                ${options.event_name ? 'AND event_name = @event_name' : ''}
                ${options.ga_session_id ? 'AND ga_session_id = @ga_session_id' : ''}
                ${options.event_date ? 'AND event_date = @event_date' : ''}
                ${options.days ? 'AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)' : ''}
                ORDER BY event_date DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    org_id: options.org_id,
                    event_name: options.event_name,
                    ga_session_id: options.ga_session_id,
                    event_date: options.event_date,
                    days: options.days || 30,
                },
            });
            metrics.trackApiCall('getGAEvents', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getGAEvents', false, Date.now() - startTime);
            logger.error('Failed to get GA events:', error);
            throw error;
        }
    }

    /**
     * Get leads (matches schema)
     */
    async getLeads(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.leads\`
                WHERE 1=1
                ${options.lead_id ? 'AND lead_id = @lead_id' : ''}
                ${options.contact_id ? 'AND contact_id = @contact_id' : ''}
                ${options.status ? 'AND status = @status' : ''}
                ${options.created_at ? 'AND created_at >= @created_at' : ''}
                ORDER BY created_at DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    lead_id: options.lead_id,
                    contact_id: options.contact_id,
                    status: options.status,
                    created_at: options.created_at,
                },
            });
            metrics.trackApiCall('getLeads', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getLeads', false, Date.now() - startTime);
            logger.error('Failed to get leads:', error);
            throw error;
        }
    }

    /**
     * Get leases (matches schema)
     */
    async getLeases(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.leases\`
                WHERE 1=1
                ${options.lease_id ? 'AND lease_id = @lease_id' : ''}
                ${options.contact_id ? 'AND contact_id = @contact_id' : ''}
                ${options.facility_id ? 'AND facility_id = @facility_id' : ''}
                ${options.is_active !== undefined ? 'AND is_active = @is_active' : ''}
                ${options.start_date ? 'AND lease_start >= @start_date' : ''}
                ${options.end_date ? 'AND lease_end <= @end_date' : ''}
                ORDER BY lease_start DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    lease_id: options.lease_id,
                    contact_id: options.contact_id,
                    facility_id: options.facility_id,
                    is_active: options.is_active,
                    start_date: options.start_date,
                    end_date: options.end_date,
                },
            });
            metrics.trackApiCall('getLeases', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getLeases', false, Date.now() - startTime);
            logger.error('Failed to get leases:', error);
            throw error;
        }
    }

    /**
     * Get managers (matches schema)
     */
    async getManagers(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.managers\`
                ${options.manager_id ? 'WHERE manager_id = @manager_id' : ''}
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    manager_id: options.manager_id,
                },
            });
            metrics.trackApiCall('getManagers', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getManagers', false, Date.now() - startTime);
            logger.error('Failed to get managers:', error);
            throw error;
        }
    }

    /**
     * Get payments (matches schema)
     */
    async getPayments(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.payments\`
                WHERE 1=1
                ${options.facility_id ? 'AND facility_id = @facility_id' : ''}
                ${options.contact_id ? 'AND contact_id = @contact_id' : ''}
                ${options.status ? 'AND payment_status = @status' : ''}
                ${options.start_date ? 'AND payment_date >= @start_date' : ''}
                ${options.end_date ? 'AND payment_date <= @end_date' : ''}
                ORDER BY payment_date DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    facility_id: options.facility_id,
                    contact_id: options.contact_id,
                    status: options.status,
                    start_date: options.start_date,
                    end_date: options.end_date,
                },
            });
            metrics.trackApiCall('getPayments', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getPayments', false, Date.now() - startTime);
            logger.error('Failed to get payments:', error);
            throw error;
        }
    }

    /**
     * Get pricing groups (matches schema)
     */
    async getPricingGroups(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.pricing_groups\`
                ${options.pg_id ? 'WHERE pg_id = @pg_id' : ''}
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    pg_id: options.pg_id,
                },
            });
            metrics.trackApiCall('getPricingGroups', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getPricingGroups', false, Date.now() - startTime);
            logger.error('Failed to get pricing groups:', error);
            throw error;
        }
    }

    /**
     * Get spaces historical (matches schema)
     */
    async getSpacesHistorical(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.spaces_historical\`
                WHERE 1=1
                ${options.unit_id ? 'AND unit_id = @unit_id' : ''}
                ${options.facility_id ? 'AND facility_id = @facility_id' : ''}
                ${options.start_date ? 'AND date >= @start_date' : ''}
                ${options.end_date ? 'AND date <= @end_date' : ''}
                ORDER BY date DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    unit_id: options.unit_id,
                    facility_id: options.facility_id,
                    start_date: options.start_date,
                    end_date: options.end_date,
                },
            });
            metrics.trackApiCall('getSpacesHistorical', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getSpacesHistorical', false, Date.now() - startTime);
            logger.error('Failed to get spaces historical:', error);
            throw error;
        }
    }

    /**
     * Get unit turnover (matches schema)
     */
    async getUnitTurnover(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.unit_turnover\`
                WHERE 1=1
                ${options.unit_id ? 'AND unit_id = @unit_id' : ''}
                ${options.facility_id ? 'AND facility_id = @facility_id' : ''}
                ${options.start_date ? 'AND move_date >= @start_date' : ''}
                ${options.end_date ? 'AND move_date <= @end_date' : ''}
                ORDER BY move_date DESC
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    unit_id: options.unit_id,
                    facility_id: options.facility_id,
                    start_date: options.start_date,
                    end_date: options.end_date,
                },
            });
            metrics.trackApiCall('getUnitTurnover', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getUnitTurnover', false, Date.now() - startTime);
            logger.error('Failed to get unit turnover:', error);
            throw error;
        }
    }

    /**
     * Get units (matches schema)
     */
    async getUnits(options = {}) {
        const startTime = Date.now();
        try {
            const query = `
                SELECT *
                FROM \`${this.datasetName}.units\`
                WHERE 1=1
                ${options.unit_id ? 'AND unit_id = @unit_id' : ''}
                ${options.facility_id ? 'AND facility_id = @facility_id' : ''}
                ${options.pg_id ? 'AND pg_id = @pg_id' : ''}
            `;
            const [rows] = await this.bigquery.query({
                query,
                params: {
                    unit_id: options.unit_id,
                    facility_id: options.facility_id,
                    pg_id: options.pg_id,
                },
            });
            metrics.trackApiCall('getUnits', true, Date.now() - startTime);
            return rows;
        } catch (error) {
            metrics.trackApiCall('getUnits', false, Date.now() - startTime);
            logger.error('Failed to get units:', error);
            throw error;
        }
    }
}

module.exports = new BigQuerySync();
