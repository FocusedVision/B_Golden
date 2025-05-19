const BaseModel = require('./BaseModel');
const { Model } = require('objection');

class Facility extends BaseModel {
    constructor() {
        super('facilities');
    }

    static get tableName() {
        return 'facilities';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['id', 'name', 'city', 'state', 'timezone'],
            properties: {
                id: { type: 'string' },
                name: { type: 'string', minLength: 1 },
                address: { type: ['string', 'null'] },
                city: { type: 'string', minLength: 1 },
                state: { type: 'string', minLength: 2, maxLength: 2 },
                zip: { type: ['string', 'null'] },
                phone: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                timezone: { type: 'string' },
                status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get relationMappings() {
        const Tenant = require('./Tenant');
        const Review = require('./Review');

        return {
            tenants: {
                relation: Model.HasManyRelation,
                modelClass: Tenant,
                join: {
                    from: 'facilities.id',
                    to: 'tenants.facility_id',
                },
            },
            reviews: {
                relation: Model.HasManyRelation,
                modelClass: Review,
                join: {
                    from: 'facilities.id',
                    to: 'reviews.facility_id',
                },
            },
        };
    }

    $beforeInsert() {
        this.created_at = new Date().toISOString();
        this.updated_at = new Date().toISOString();
    }

    $beforeUpdate() {
        this.updated_at = new Date().toISOString();
    }

    static async findAll(criteria = {}) {
        const query = this.query();

        // Add where clauses for each criteria
        Object.entries(criteria).forEach(([key, value]) => {
            query.where(key, value);
        });

        return await query;
    }

    static async findById(id) {
        return await this.query().findById(id);
    }

    static async create(data) {
        return await this.query().insert(data);
    }

    static async update(id, data) {
        return await this.query().patchAndFetchById(id, data);
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

    async updateStatus(facilityId, status) {
        return this.update(facilityId, { status });
    }

    async findActive() {
        const query = `
            SELECT *
            FROM facilities
            WHERE status = 'active'
            ORDER BY name ASC
        `;
        const result = await this.pool.query(query);
        return result.rows;
    }
}

module.exports = new Facility();
