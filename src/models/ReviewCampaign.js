const BaseModel = require('./BaseModel');

class ReviewCampaign extends BaseModel {
    constructor() {
        super('review_campaigns');
    }

    async findActiveCampaigns(facilityId) {
        const query = `
            SELECT rc.*
            FROM review_campaigns rc
            WHERE rc.facility_id = $1
            AND rc.status = 'active'
            AND rc.start_date <= CURRENT_DATE
            AND (rc.end_date IS NULL OR rc.end_date >= CURRENT_DATE)
        `;
        const result = await this.pool.query(query, [facilityId]);
        return result.rows;
    }

    async findWithStats(campaignId) {
        const query = `
            SELECT rc.*,
                   COUNT(DISTINCT rr.id) as total_requests,
                   COUNT(DISTINCT CASE WHEN rr.status = 'completed' THEN rr.id END) as completed_reviews,
                   AVG(rr.rating) as average_rating
            FROM review_campaigns rc
            LEFT JOIN review_requests rr ON rc.id = rr.campaign_id
            WHERE rc.id = $1
            GROUP BY rc.id
        `;
        const result = await this.pool.query(query, [campaignId]);
        return result.rows[0];
    }

    async updateStatus(campaignId, status) {
        return this.update(campaignId, { status });
    }

    async findPendingRequests(campaignId) {
        const query = `
            SELECT rr.*, t.name as tenant_name, t.email, t.phone
            FROM review_requests rr
            JOIN tenants t ON rr.tenant_id = t.id
            WHERE rr.campaign_id = $1
            AND rr.status = 'pending'
            ORDER BY rr.created_at ASC
        `;
        const result = await this.pool.query(query, [campaignId]);
        return result.rows;
    }
}

module.exports = new ReviewCampaign();
