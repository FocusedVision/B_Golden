const BaseModel = require('./BaseModel');

class Tenant extends BaseModel {
    constructor() {
        super('tenants');
    }

    async findEligibleForReview(facilityId) {
        const query = `
            SELECT t.*
            FROM tenants t
            WHERE t.facility_id = $1
            AND t.is_good_standing = true
            AND t.notification_opt_in = true
            AND t.move_out_date IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM review_requests rr
                WHERE rr.tenant_id = t.id
                AND rr.created_at >= CURRENT_DATE - INTERVAL '30 days'
            )
            ORDER BY t.move_in_date ASC
            LIMIT 5
        `;
        const result = await this.pool.query(query, [facilityId]);
        return result.rows;
    }

    async findWithReviewHistory(tenantId) {
        const query = `
            SELECT t.*,
                   json_agg(rr.*) as review_history
            FROM tenants t
            LEFT JOIN review_requests rr ON t.id = rr.tenant_id
            WHERE t.id = $1
            GROUP BY t.id
        `;
        const result = await this.pool.query(query, [tenantId]);
        return result.rows[0];
    }

    async updateStanding(tenantId, isGoodStanding) {
        return this.update(tenantId, { is_good_standing: isGoodStanding });
    }

    async updateNotificationPreference(tenantId, optIn) {
        return this.update(tenantId, { notification_opt_in: optIn });
    }
}

module.exports = new Tenant();
