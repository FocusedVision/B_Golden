/**
 * BigQuerySync Service
 *
 * This service handles synchronization of data between BigQuery and the local database.
 * It provides methods to fetch and process data from various BigQuery views and tables.
 *
 * @class BigQuerySync
 */
const { BigQuery } = require('@google-cloud/bigquery');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Import all models
const Unit = require('../models/Unit');
const BookEntry = require('../models/BookEntry');
const Contact = require('../models/Contact');
const CustomerTouch = require('../models/CustomerTouch');
const GAEvent = require('../models/GAEvent');
const Lead = require('../models/Lead');
const Lease = require('../models/Lease');
const Manager = require('../models/Manager');
const Payment = require('../models/Payment');
const PricingGroup = require('../models/PricingGroup');
const SpaceHistorical = require('../models/SpaceHistorical');
const UnitTurnover = require('../models/UnitTurnover');

/**
 * Utility function to process date fields in BigQuery response
 * @param {Object} row - The row to process
 * @param {string} field - The field name to process
 * @returns {string|null} The processed date value
 */
const processDateField = (row, field) => {
    if (row[field] && typeof row[field] === 'object' && row[field].value) {
        return row[field].value;
    }
    return row[field];
};

/**
 * Utility function to process numeric fields in BigQuery response
 * @param {Object} row - The row to process
 * @param {string} field - The field name to process
 * @returns {number|null} The processed numeric value
 */
const processNumericField = (row, field) => {
    if (row[field]) {
        return parseFloat(row[field]);
    }
    return row[field];
};

class BigQuerySync {
    /**
     * Creates an instance of BigQuerySync
     * @throws {Error} If required environment variables are not set
     */
    constructor() {
        if (!process.env.GOOGLE_CLOUD_PROJECT || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            throw new Error(
                'Required environment variables GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS must be set'
            );
        }

        this.bigquery = new BigQuery({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        this.datasetName = 'authorized_views';
        this.batchSize = parseInt(process.env.BIGQUERY_SYNC_BATCH_SIZE || '1000', 10);
        logger.info('BigQuerySync initialized successfully');
    }

    /**
     * Executes a BigQuery query with error handling and metrics tracking
     * @param {string} operationName - Name of the operation for metrics
     * @param {Object} queryConfig - Query configuration object
     * @returns {Promise<Array>} Query results
     * @throws {Error} If query execution fails
     */
    async executeQuery(operationName, queryConfig) {
        const startTime = Date.now();
        logger.debug(`Executing ${operationName} query`);

        try {
            const [rows] = await this.bigquery.query(queryConfig);
            const duration = Date.now() - startTime;
            metrics.trackApiCall(operationName, true, duration);
            logger.debug(`Successfully executed ${operationName} query in ${duration}ms`);
            return rows;
        } catch (error) {
            const duration = Date.now() - startTime;
            metrics.trackApiCall(operationName, false, duration);
            logger.error(`Failed to execute ${operationName} query:`, {
                error: error.message,
                duration,
                query: queryConfig.query,
            });
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    /**
     * Saves data to the database with error handling
     * @param {string} modelName - Name of the model for logging
     * @param {Object} Model - Mongoose model
     * @param {Array} data - Data to save
     * @returns {Promise<void>}
     */
    async saveToDatabase(modelName, Model, data) {
        if (!data || data.length === 0) {
            logger.debug(`No ${modelName} data to save`);
            return;
        }

        logger.debug(`Saving ${data.length} ${modelName} to database`);
        try {
            await Model.upsertMany(data);
            logger.info(`Successfully saved ${data.length} ${modelName} to database`);
        } catch (error) {
            logger.error(`Failed to save ${modelName} to database:`, {
                error: error.message,
                count: data.length,
            });
            throw new Error(`Database save failed: ${error.message}`);
        }
    }

    /**
     * Get all available views in the dataset
     * @returns {Promise<Array>} List of views
     */
    async getViews() {
        return this.executeQuery('getViews', {
            query: `SELECT * FROM \`${this.datasetName}.INFORMATION_SCHEMA.TABLES\` WHERE table_type = 'VIEW'`,
        });
    }

    /**
     * Get book entries with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.facility] - Facility ID filter
     * @param {Date|string} [options.startDate] - Start date filter
     * @param {Date|string} [options.endDate] - End date filter
     * @returns {Promise<Array>} Book entries
     */
    async getBookEntries(options = {}) {
        const params = {};
        const conditions = [];

        if (options.facility) {
            params.facility = String(options.facility);
            conditions.push('facility = @facility');
        }
        if (options.startDate) {
            params.startDate = new Date(options.startDate);
            conditions.push('entry_date_time >= @startDate');
        }
        if (options.endDate) {
            params.endDate = new Date(options.endDate);
            conditions.push('entry_date_time <= @endDate');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.book_entries\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY entry_date_time DESC
        `;

        const rows = await this.executeQuery('getBookEntries', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            entry_date_time: processDateField(row, 'entry_date_time'),
            accrual_start: processDateField(row, 'accrual_start'),
            amount: processNumericField(row, 'amount'),
            amt_revenue: processNumericField(row, 'amt_revenue'),
            amt_payment: processNumericField(row, 'amt_payment'),
            amt_asset: processNumericField(row, 'amt_asset'),
            amt_liability: processNumericField(row, 'amt_liability'),
            amt_transfer: processNumericField(row, 'amt_transfer'),
        }));

        await this.saveToDatabase('book entries', BookEntry, processedRows);
        return processedRows;
    }

    /**
     * Get contacts with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.contact_id] - Contact ID filter
     * @returns {Promise<Array>} Contacts
     */
    async getContacts(options = {}) {
        const params = {};
        const conditions = [];

        if (options.contact_id) {
            params.contact_id = String(options.contact_id);
            conditions.push('contact_id = @contact_id');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.contact\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        `;

        const rows = await this.executeQuery('getContacts', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            created_at: processDateField(row, 'created_at'),
            updated_at: processDateField(row, 'updated_at'),
            date_of_birth: processDateField(row, 'date_of_birth'),
        }));

        await this.saveToDatabase('contacts', Contact, processedRows);
        return processedRows;
    }

    /**
     * Get customer touches with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.contact_id] - Contact ID filter
     * @param {string} [options.lease_id] - Lease ID filter
     * @param {string} [options.lead_id] - Lead ID filter
     * @param {string} [options.ga_session] - GA session filter
     * @param {number} [options.days] - Days filter for recent touches
     * @returns {Promise<Array>} Customer touches
     */
    async getCustomerTouches(options = {}) {
        const params = {};
        const conditions = [];

        if (options.contact_id) {
            params.contact_id = String(options.contact_id);
            conditions.push('contact_id = @contact_id');
        }
        if (options.lease_id) {
            params.lease_id = String(options.lease_id);
            conditions.push('lease_id = @lease_id');
        }
        if (options.lead_id) {
            params.lead_id = String(options.lead_id);
            conditions.push('lead_id = @lead_id');
        }
        if (options.ga_session) {
            params.ga_session = String(options.ga_session);
            conditions.push('ga_session = @ga_session');
        }
        if (options.days) {
            params.days = parseInt(options.days, 10) || 30;
            conditions.push(
                'TIMESTAMP(created_at) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)'
            );
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.customer_touches\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY created_at DESC
        `;

        const rows = await this.executeQuery('getCustomerTouches', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            created_at: processDateField(row, 'created_at'),
            updated_at: processDateField(row, 'updated_at'),
        }));

        await this.saveToDatabase('customer touches', CustomerTouch, processedRows);
        return processedRows;
    }

    /**
     * Get Google Analytics events with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.org_id] - Organization ID filter
     * @param {string} [options.event_name] - Event name filter
     * @param {string} [options.ga_session_id] - GA session ID filter
     * @param {Date|string} [options.event_date] - Event date filter
     * @param {number} [options.days] - Days filter for recent events
     * @returns {Promise<Array>} GA events
     */
    async getGAEvents(options = {}) {
        const params = {};
        const conditions = [];

        if (options.org_id) {
            params.org_id = String(options.org_id);
            conditions.push('org_id = @org_id');
        }
        if (options.event_name) {
            params.event_name = String(options.event_name);
            conditions.push('event_name = @event_name');
        }
        if (options.ga_session_id) {
            params.ga_session_id = BigInt(options.ga_session_id);
            conditions.push('ga_session_id = @ga_session_id');
        }
        if (options.event_date) {
            params.event_date = new Date(options.event_date);
            conditions.push('event_date = @event_date');
        }
        if (options.days) {
            params.days = parseInt(options.days, 10) || 30;
            conditions.push('event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.ga_events\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY event_date DESC
        `;

        const rows = await this.executeQuery('getGAEvents', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            event_date: processDateField(row, 'event_date'),
        }));

        await this.saveToDatabase('GA events', GAEvent, processedRows);
        return processedRows;
    }

    /**
     * Get leads with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.lead_id] - Lead ID filter
     * @param {string} [options.contact_id] - Contact ID filter
     * @param {string} [options.status] - Status filter
     * @param {Date|string} [options.created_at] - Creation date filter
     * @returns {Promise<Array>} Leads
     */
    async getLeads(options = {}) {
        const params = {};
        const conditions = [];

        if (options.lead_id) {
            params.lead_id = String(options.lead_id);
            conditions.push('lead_id = @lead_id');
        }
        if (options.contact_id) {
            params.contact_id = String(options.contact_id);
            conditions.push('contact_id = @contact_id');
        }
        if (options.status) {
            params.status = String(options.status);
            conditions.push('status = @status');
        }
        if (options.created_at) {
            params.created_at = new Date(options.created_at);
            conditions.push('created_at >= @created_at');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.leads\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY created_at DESC
        `;

        const rows = await this.executeQuery('getLeads', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            created_at: processDateField(row, 'created_at'),
            updated_at: processDateField(row, 'updated_at'),
            converted_datetime: processDateField(row, 'converted_datetime'),
        }));

        await this.saveToDatabase('leads', Lead, processedRows);
        return processedRows;
    }

    /**
     * Get leases with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.lease_id] - Lease ID filter
     * @param {string} [options.contact_id] - Contact ID filter
     * @param {string} [options.facility_id] - Facility ID filter
     * @param {boolean} [options.is_active] - Active status filter
     * @param {Date|string} [options.start_date] - Start date filter
     * @param {Date|string} [options.end_date] - End date filter
     * @returns {Promise<Array>} Leases
     */
    async getLeases(options = {}) {
        const params = {};
        const conditions = [];

        if (options.lease_id) {
            params.lease_id = String(options.lease_id);
            conditions.push('lease_id = @lease_id');
        }
        if (options.contact_id) {
            params.contact_id = String(options.contact_id);
            conditions.push('contact_id = @contact_id');
        }
        if (options.facility_id) {
            params.facility_id = String(options.facility_id);
            conditions.push('facility_id = @facility_id');
        }
        if (options.is_active !== undefined) {
            params.is_active = parseInt(options.is_active, 10);
            conditions.push('is_active = @is_active');
        }
        if (options.start_date) {
            params.start_date = new Date(options.start_date);
            conditions.push('lease_started >= @start_date');
        }
        if (options.end_date) {
            params.end_date = new Date(options.end_date);
            conditions.push('lease_ended <= @end_date');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.leases\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY lease_started DESC
        `;

        const rows = await this.executeQuery('getLeases', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            lease_started: processDateField(row, 'lease_started'),
            lease_ended: processDateField(row, 'lease_ended'),
            lease_rent_next_chg_date: processDateField(row, 'lease_rent_next_chg_date'),
            lease_rent_last_chg_date: processDateField(row, 'lease_rent_last_chg_date'),
            status_late_since_date: processDateField(row, 'status_late_since_date'),
            status_paid_through_date: processDateField(row, 'status_paid_through_date'),
            status_paid_on_date: processDateField(row, 'status_paid_on_date'),
            lease_rent_original: processNumericField(row, 'lease_rent_original'),
            lease_rent_current: processNumericField(row, 'lease_rent_current'),
            lease_rent_next: processNumericField(row, 'lease_rent_next'),
            ins_premium: processNumericField(row, 'ins_premium'),
            ins_coverage_level: processNumericField(row, 'ins_coverage_level'),
            lease_lifetime_payments: processNumericField(row, 'lease_lifetime_payments'),
            balance_ar: processNumericField(row, 'balance_ar'),
            balance_deposit: processNumericField(row, 'balance_deposit'),
            balance_prepaid: processNumericField(row, 'balance_prepaid'),
        }));

        await this.saveToDatabase('leases', Lease, processedRows);
        return processedRows;
    }

    /**
     * Get managers with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.manager_id] - Manager ID filter
     * @returns {Promise<Array>} Managers
     */
    async getManagers(options = {}) {
        const params = {};
        const conditions = [];

        if (options.manager_id) {
            params.manager_id = String(options.manager_id);
            conditions.push('manager_id = @manager_id');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.managers\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        `;

        const rows = await this.executeQuery('getManagers', { query, params });
        await this.saveToDatabase('managers', Manager, rows);
        return rows;
    }

    /**
     * Get payments with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.facility_id] - Facility ID filter
     * @param {string} [options.contact_id] - Contact ID filter
     * @param {string} [options.status] - Payment status filter
     * @param {Date|string} [options.start_date] - Start date filter
     * @param {Date|string} [options.end_date] - End date filter
     * @returns {Promise<Array>} Payments
     */
    async getPayments(options = {}) {
        const params = {};
        const conditions = [];

        if (options.facility_id) {
            params.facility_id = String(options.facility_id);
            conditions.push('facility_id = @facility_id');
        }
        if (options.contact_id) {
            params.contact_id = String(options.contact_id);
            conditions.push('contact_id = @contact_id');
        }
        if (options.status) {
            params.status = String(options.status);
            conditions.push('payment_status = @status');
        }
        if (options.start_date) {
            params.start_date = new Date(options.start_date);
            conditions.push('payment_date >= @start_date');
        }
        if (options.end_date) {
            params.end_date = new Date(options.end_date);
            conditions.push('payment_date <= @end_date');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.payments\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY payment_date DESC
        `;

        const rows = await this.executeQuery('getPayments', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            payment_date: processDateField(row, 'payment_date'),
            payment_datetime: processDateField(row, 'payment_datetime'),
            payment_amount: processNumericField(row, 'payment_amount'),
        }));

        await this.saveToDatabase('payments', Payment, processedRows);
        return processedRows;
    }

    /**
     * Get pricing groups with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.pg_id] - Pricing group ID filter
     * @returns {Promise<Array>} Pricing groups
     */
    async getPricingGroups(options = {}) {
        const params = {};
        const conditions = [];

        if (options.pg_id) {
            params.pg_id = String(options.pg_id);
            conditions.push('pg_id = @pg_id');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.pricing_group\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        `;

        const rows = await this.executeQuery('getPricingGroups', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            price: processNumericField(row, 'price'),
            width: processNumericField(row, 'width'),
            height: processNumericField(row, 'height'),
            depth: processNumericField(row, 'depth'),
        }));

        await this.saveToDatabase('pricing groups', PricingGroup, processedRows);
        return processedRows;
    }

    /**
     * Get spaces historical data with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.unit_id] - Unit ID filter
     * @param {string} [options.facility_id] - Facility ID filter
     * @param {Date|string} [options.start_date] - Start date filter
     * @param {Date|string} [options.end_date] - End date filter
     * @returns {Promise<Array>} Spaces historical data
     */
    async getSpacesHistorical(options = {}) {
        const params = {};
        const conditions = [];

        if (options.unit_id) {
            params.unit_id = String(options.unit_id);
            conditions.push('unit_id = @unit_id');
        }
        if (options.facility_id) {
            params.facility_id = String(options.facility_id);
            conditions.push('facility_id = @facility_id');
        }
        if (options.start_date) {
            params.start_date = new Date(options.start_date);
            conditions.push('date >= @start_date');
        }
        if (options.end_date) {
            params.end_date = new Date(options.end_date);
            conditions.push('date <= @end_date');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.spaces_historical\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY date DESC
        `;

        const rows = await this.executeQuery('getSpacesHistorical', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            date: processDateField(row, 'date'),
            occ_start_dt: processDateField(row, 'occ_start_dt'),
            width: processNumericField(row, 'width'),
            depth: processNumericField(row, 'depth'),
            height: processNumericField(row, 'height'),
            street_rate: processNumericField(row, 'street_rate'),
            occ_rate: processNumericField(row, 'occ_rate'),
        }));

        await this.saveToDatabase('spaces historical', SpaceHistorical, processedRows);
        return processedRows;
    }

    /**
     * Get unit turnover data with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.unit_id] - Unit ID filter
     * @param {string} [options.facility_id] - Facility ID filter
     * @param {Date|string} [options.start_date] - Start date filter
     * @param {Date|string} [options.end_date] - End date filter
     * @returns {Promise<Array>} Unit turnover data
     */
    async getUnitTurnover(options = {}) {
        const params = {};
        const conditions = [];

        if (options.unit_id) {
            params.unit_id = String(options.unit_id);
            conditions.push('unit_id = @unit_id');
        }
        if (options.facility_id) {
            params.facility_id = String(options.facility_id);
            conditions.push('facility_id = @facility_id');
        }
        if (options.start_date) {
            params.start_date = new Date(options.start_date);
            conditions.push('move_date >= @start_date');
        }
        if (options.end_date) {
            params.end_date = new Date(options.end_date);
            conditions.push('move_date <= @end_date');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.unit_turnover\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY move_date DESC
        `;

        const rows = await this.executeQuery('getUnitTurnover', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            move_date: processDateField(row, 'move_date'),
            lease_start_date: processDateField(row, 'lease_start_date'),
            lease_end_date: processDateField(row, 'lease_end_date'),
            unit_width: processNumericField(row, 'unit_width'),
            unit_depth: processNumericField(row, 'unit_depth'),
            unit_height: processNumericField(row, 'unit_height'),
            lease_rent: processNumericField(row, 'lease_rent'),
            ins_premium: processNumericField(row, 'ins_premium'),
            ins_coverage_level: processNumericField(row, 'ins_coverage_level'),
            pg_standard_rate: processNumericField(row, 'pg_standard_rate'),
        }));

        await this.saveToDatabase('unit turnover', UnitTurnover, processedRows);
        return processedRows;
    }

    /**
     * Get units with optional filtering
     * @param {Object} options - Query options
     * @param {string} [options.unit_id] - Unit ID filter
     * @param {string} [options.facility_id] - Facility ID filter
     * @param {string} [options.pg_id] - Pricing group ID filter
     * @returns {Promise<Array>} Units
     */
    async getUnits(options = {}) {
        const params = {};
        const conditions = [];

        if (options.unit_id) {
            params.unit_id = String(options.unit_id);
            conditions.push('unit_id = @unit_id');
        }
        if (options.facility_id) {
            params.facility_id = String(options.facility_id);
            conditions.push('facility_id = @facility_id');
        }
        if (options.pg_id) {
            params.pg_id = String(options.pg_id);
            conditions.push('pg_id = @pg_id');
        }

        const query = `
            SELECT *
            FROM \`${this.datasetName}.units\`
            ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        `;

        const rows = await this.executeQuery('getUnits', { query, params });

        const processedRows = rows.map((row) => ({
            ...row,
            rate_managed: processNumericField(row, 'rate_managed'),
            unit_width: processNumericField(row, 'unit_width'),
            unit_depth: processNumericField(row, 'unit_depth'),
            unit_height: processNumericField(row, 'unit_height'),
        }));

        await this.saveToDatabase('units', Unit, processedRows);
        return processedRows;
    }
}

module.exports = new BigQuerySync();
