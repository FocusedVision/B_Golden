const logger = require('./logger');

class Metrics {
    constructor() {
        this.metrics = {
            cubby: {
                apiCalls: {
                    total: 0,
                    success: 0,
                    failure: 0,
                    byEndpoint: {}
                },
                sync: {
                    facilities: {
                        total: 0,
                        success: 0,
                        failure: 0,
                        lastSync: null,
                        duration: []
                    },
                    tenants: {
                        total: 0,
                        success: 0,
                        failure: 0,
                        lastSync: null,
                        duration: []
                    }
                },
                webhooks: {
                    total: 0,
                    success: 0,
                    failure: 0,
                    byEvent: {}
                }
            }
        };
    }

    // API Call Metrics
    trackApiCall(endpoint, success, duration) {
        this.metrics.cubby.apiCalls.total++;
        if (success) {
            this.metrics.cubby.apiCalls.success++;
        } else {
            this.metrics.cubby.apiCalls.failure++;
        }

        if (!this.metrics.cubby.apiCalls.byEndpoint[endpoint]) {
            this.metrics.cubby.apiCalls.byEndpoint[endpoint] = {
                total: 0,
                success: 0,
                failure: 0,
                avgDuration: 0
            };
        }

        const endpointMetrics = this.metrics.cubby.apiCalls.byEndpoint[endpoint];
        endpointMetrics.total++;
        if (success) {
            endpointMetrics.success++;
        } else {
            endpointMetrics.failure++;
        }

        // Update average duration
        endpointMetrics.avgDuration = 
            ((endpointMetrics.avgDuration * (endpointMetrics.total - 1)) + duration) / endpointMetrics.total;
    }

    // Sync Metrics
    trackFacilitySync(success, count, duration) {
        const metrics = this.metrics.cubby.sync.facilities;
        metrics.total++;
        if (success) {
            metrics.success++;
        } else {
            metrics.failure++;
        }
        metrics.lastSync = new Date();
        metrics.duration.push(duration);
        
        // Keep only last 100 durations
        if (metrics.duration.length > 100) {
            metrics.duration.shift();
        }
    }

    trackTenantSync(success, count, duration) {
        const metrics = this.metrics.cubby.sync.tenants;
        metrics.total++;
        if (success) {
            metrics.success++;
        } else {
            metrics.failure++;
        }
        metrics.lastSync = new Date();
        metrics.duration.push(duration);
        
        // Keep only last 100 durations
        if (metrics.duration.length > 100) {
            metrics.duration.shift();
        }
    }

    // Webhook Metrics
    trackWebhook(event, success) {
        this.metrics.cubby.webhooks.total++;
        if (success) {
            this.metrics.cubby.webhooks.success++;
        } else {
            this.metrics.cubby.webhooks.failure++;
        }

        if (!this.metrics.cubby.webhooks.byEvent[event]) {
            this.metrics.cubby.webhooks.byEvent[event] = {
                total: 0,
                success: 0,
                failure: 0
            };
        }

        const eventMetrics = this.metrics.cubby.webhooks.byEvent[event];
        eventMetrics.total++;
        if (success) {
            eventMetrics.success++;
        } else {
            eventMetrics.failure++;
        }
    }

    // Get Metrics
    getMetrics() {
        return this.metrics;
    }

    // Get Health Status
    getHealthStatus() {
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
        
        const facilitySync = this.metrics.cubby.sync.facilities;
        const tenantSync = this.metrics.cubby.sync.tenants;
        
        const facilitySyncHealthy = facilitySync.lastSync && facilitySync.lastSync > sixHoursAgo;
        const tenantSyncHealthy = tenantSync.lastSync && tenantSync.lastSync > sixHoursAgo;
        
        const apiHealth = this.metrics.cubby.apiCalls.total > 0 && 
            (this.metrics.cubby.apiCalls.success / this.metrics.cubby.apiCalls.total) > 0.95;

        return {
            status: facilitySyncHealthy && tenantSyncHealthy && apiHealth ? 'healthy' : 'unhealthy',
            details: {
                facilitySync: {
                    status: facilitySyncHealthy ? 'healthy' : 'unhealthy',
                    lastSync: facilitySync.lastSync,
                    successRate: facilitySync.total > 0 ? 
                        (facilitySync.success / facilitySync.total) * 100 : 0
                },
                tenantSync: {
                    status: tenantSyncHealthy ? 'healthy' : 'unhealthy',
                    lastSync: tenantSync.lastSync,
                    successRate: tenantSync.total > 0 ? 
                        (tenantSync.success / tenantSync.total) * 100 : 0
                },
                api: {
                    status: apiHealth ? 'healthy' : 'unhealthy',
                    successRate: this.metrics.cubby.apiCalls.total > 0 ? 
                        (this.metrics.cubby.apiCalls.success / this.metrics.cubby.apiCalls.total) * 100 : 0
                }
            }
        };
    }

    // Log Metrics
    logMetrics() {
        logger.info('Cubby PMS Metrics:', {
            apiCalls: {
                total: this.metrics.cubby.apiCalls.total,
                successRate: this.metrics.cubby.apiCalls.total > 0 ? 
                    (this.metrics.cubby.apiCalls.success / this.metrics.cubby.apiCalls.total) * 100 : 0
            },
            sync: {
                facilities: {
                    total: this.metrics.cubby.sync.facilities.total,
                    successRate: this.metrics.cubby.sync.facilities.total > 0 ? 
                        (this.metrics.cubby.sync.facilities.success / this.metrics.cubby.sync.facilities.total) * 100 : 0,
                    lastSync: this.metrics.cubby.sync.facilities.lastSync
                },
                tenants: {
                    total: this.metrics.cubby.sync.tenants.total,
                    successRate: this.metrics.cubby.sync.tenants.total > 0 ? 
                        (this.metrics.cubby.sync.tenants.success / this.metrics.cubby.sync.tenants.total) * 100 : 0,
                    lastSync: this.metrics.cubby.sync.tenants.lastSync
                }
            },
            webhooks: {
                total: this.metrics.cubby.webhooks.total,
                successRate: this.metrics.cubby.webhooks.total > 0 ? 
                    (this.metrics.cubby.webhooks.success / this.metrics.cubby.webhooks.total) * 100 : 0
            }
        });
    }
}

module.exports = new Metrics(); 