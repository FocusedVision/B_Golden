const axios = require('axios');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const Tenant = require('../models/Tenant');
const Facility = require('../models/Facility');

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffFactor: 2,
};

// Utility function for exponential backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry wrapper function
async function withRetry(operation, operationName) {
    let lastError;
    let delay = RETRY_CONFIG.initialDelay;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Don't retry if it's a validation error or authentication error
            if (error.response?.status === 400 || error.response?.status === 401) {
                throw error;
            }

            if (attempt < RETRY_CONFIG.maxRetries) {
                logger.warn(
                    `${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}). Retrying in ${delay}ms...`
                );
                await sleep(delay);
                delay = Math.min(delay * RETRY_CONFIG.backoffFactor, RETRY_CONFIG.maxDelay);
            }
        }
    }

    logger.error(`${operationName} failed after ${RETRY_CONFIG.maxRetries} attempts:`, lastError);
    throw lastError;
}

class CubbyPMS {
    constructor() {
        this.baseUrl = process.env.CUBBY_API_URL;
        this.apiKey = process.env.CUBBY_API_KEY;
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
        });

        // Add response interceptor for error handling and metrics
        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.startTime;
                metrics.trackApiCall(response.config.url, true, duration);
                return response;
            },
            (error) => {
                const duration = Date.now() - error.config.startTime;
                metrics.trackApiCall(error.config.url, false, duration);

                if (error.response) {
                    logger.error('Cubby API Error:', {
                        status: error.response.status,
                        data: error.response.data,
                        url: error.config.url,
                    });
                } else if (error.request) {
                    logger.error('Cubby API No Response:', {
                        url: error.config.url,
                        message: error.message,
                    });
                } else {
                    logger.error('Cubby API Request Error:', error.message);
                }
                return Promise.reject(error);
            }
        );

        // Add request interceptor to track start time
        this.client.interceptors.request.use(
            (config) => {
                config.startTime = Date.now();
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
    }

    async initialize() {
        const startTime = Date.now();
        try {
            await withRetry(async () => {
                await this.client.get('/api/v1/health');
                logger.info('Cubby PMS API initialized successfully');
            }, 'Cubby PMS initialization');
            metrics.trackApiCall('/api/v1/health', true, Date.now() - startTime);
        } catch (error) {
            metrics.trackApiCall('/api/v1/health', false, Date.now() - startTime);
            throw error;
        }
    }

    async syncTenants(facilityId) {
        const startTime = Date.now();
        try {
            const result = await withRetry(async () => {
                const response = await this.client.get(`/api/v1/facilities/${facilityId}/tenants`);
                const tenants = response.data;
                let successCount = 0;
                let failureCount = 0;

                for (const tenant of tenants) {
                    try {
                        const tenantData = {
                            facility_id: facilityId,
                            name: tenant.name,
                            unit_number: tenant.unitNumber,
                            phone: tenant.phone,
                            email: tenant.email,
                            move_in_date: tenant.moveInDate,
                            move_out_date: tenant.moveOutDate,
                            is_good_standing: this.determineGoodStanding(tenant),
                            notification_opt_in: tenant.notificationPreferences?.optIn || false,
                            created_at: tenant.createdAt,
                            updated_at: tenant.updatedAt,
                        };

                        // Validate required fields
                        if (!tenantData.name || !tenantData.unit_number) {
                            logger.warn(
                                `Skipping tenant sync - missing required fields: ${JSON.stringify(tenantData)}`
                            );
                            failureCount++;
                            continue;
                        }

                        const existingTenants = await Tenant.findAll({
                            facility_id: facilityId,
                            unit_number: tenant.unitNumber,
                        });

                        if (existingTenants.length > 0) {
                            await Tenant.update(existingTenants[0].id, tenantData);
                        } else {
                            await Tenant.create(tenantData);
                        }
                        successCount++;
                    } catch (error) {
                        logger.error(`Failed to sync tenant ${tenant.unitNumber}:`, error);
                        failureCount++;
                    }
                }

                logger.info(
                    `Tenant sync completed for facility ${facilityId}. Success: ${successCount}, Failures: ${failureCount}`
                );
                return { successCount, failureCount, total: tenants.length };
            }, `Sync tenants for facility ${facilityId}`);

            const duration = Date.now() - startTime;
            metrics.trackTenantSync(true, result.total, duration);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            metrics.trackTenantSync(false, 0, duration);
            throw error;
        }
    }

    async syncFacilities() {
        const startTime = Date.now();
        try {
            const result = await withRetry(async () => {
                const response = await this.client.get('/api/v1/facilities');
                const facilities = response.data;
                let successCount = 0;
                let failureCount = 0;

                for (const facility of facilities) {
                    try {
                        const facilityData = {
                            id: facility.id,
                            name: facility.name,
                            gmb_place_id: facility.gmbPlaceId,
                            gmb_link: facility.gmbLink,
                            city: facility.city,
                            state: facility.state,
                            timezone: facility.timezone,
                            context_notes: facility.contextNotes,
                            created_at: facility.createdAt,
                            updated_at: facility.updatedAt,
                        };

                        // Validate required fields
                        if (!facilityData.id || !facilityData.name) {
                            logger.warn(
                                `Skipping facility sync - missing required fields: ${JSON.stringify(facilityData)}`
                            );
                            failureCount++;
                            continue;
                        }

                        const existingFacilities = await Facility.findAll({
                            id: facility.id,
                        });

                        if (existingFacilities.length > 0) {
                            await Facility.update(facility.id, facilityData);
                        } else {
                            await Facility.create({
                                id: facility.id,
                                ...facilityData,
                            });
                        }
                        successCount++;
                    } catch (error) {
                        logger.error(`Failed to sync facility ${facility.id}:`, error);
                        failureCount++;
                    }
                }

                logger.info(
                    `Facility sync completed. Success: ${successCount}, Failures: ${failureCount}`
                );
                return { successCount, failureCount, total: facilities.length };
            }, 'Sync facilities');

            const duration = Date.now() - startTime;
            metrics.trackFacilitySync(true, result.total, duration);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            metrics.trackFacilitySync(false, 0, duration);
            throw error;
        }
    }

    async handleWebhook(payload) {
        try {
            const { event, data } = payload;
            let success = false;

            switch (event) {
                case 'tenant.created':
                case 'tenant.updated':
                    await this.syncTenants(data.facilityId);
                    success = true;
                    break;
                case 'facility.created':
                case 'facility.updated':
                    await this.syncFacilities();
                    success = true;
                    break;
                default:
                    logger.warn(`Unhandled webhook event: ${event}`);
            }

            metrics.trackWebhook(event, success);
            return true;
        } catch (error) {
            metrics.trackWebhook(payload.event, false);
            logger.error('Failed to handle webhook:', error);
            throw error;
        }
    }

    determineGoodStanding(tenant) {
        return tenant.paymentStatus === 'current' && !tenant.auctionStatus && tenant.balance <= 0;
    }

    async getTenantDetails(tenantId) {
        try {
            const response = await this.client.get(`/api/v1/tenants/${tenantId}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to get tenant details for ${tenantId}:`, error);
            throw error;
        }
    }

    async getFacilityDetails(facilityId) {
        try {
            const response = await this.client.get(`/api/v1/facilities/${facilityId}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to get facility details for ${facilityId}:`, error);
            throw error;
        }
    }
}

module.exports = new CubbyPMS();
