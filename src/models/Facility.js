const BaseModel = require('./BaseModel');

class Facility extends BaseModel {
    constructor() {
        super('facilities');
    }

    async findWithTenants(facilityId) {
        const query = `
            SELECT f.*, 
                   json_agg(t.*) as tenants
            FROM facilities f
            LEFT JOIN tenants t ON f.id = t.facility_id
            WHERE f.id = $1
            GROUP BY f.id
        `;
        const result = await this.pool.query(query, [facilityId]);
        return result.rows[0];
    }

    async findWithActiveCampaigns(facilityId) {
        const query = `
            SELECT f.*, 
                   json_agg(rc.*) as campaigns
            FROM facilities f
            LEFT JOIN review_campaigns rc ON f.id = rc.facility_id
            WHERE f.id = $1 AND rc.status = 'active'
            GROUP BY f.id
        `;
        const result = await this.pool.query(query, [facilityId]);
        return result.rows[0];
    }

    async findWithReviewStats(facilityId) {
        const query = `
            SELECT f.*,
                   COUNT(DISTINCT rr.id) as total_reviews,
                   AVG(rr.rating) as average_rating,
                   COUNT(DISTINCT CASE WHEN rr.rating >= 4 THEN rr.id END) as positive_reviews
            FROM facilities f
            LEFT JOIN review_requests rr ON f.id = rr.facility_id
            WHERE f.id = $1
            GROUP BY f.id
        `;
        const result = await this.pool.query(query, [facilityId]);
        return result.rows[0];
    }
}

module.exports = new Facility();
