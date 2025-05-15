const { pool } = require('../config/database');

class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
    }

    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    async findAll(conditions = {}, orderBy = 'created_at DESC') {
        let query = `SELECT * FROM ${this.tableName}`;
        const values = [];

        if (Object.keys(conditions).length > 0) {
            const whereClauses = [];
            Object.entries(conditions).forEach(([key, value], index) => {
                whereClauses.push(`${key} = $${index + 1}`);
                values.push(value);
            });
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        query += ` ORDER BY ${orderBy}`;

        const result = await pool.query(query, values);
        return result.rows;
    }

    async create(data) {
        const columns = Object.keys(data).join(', ');
        const values = Object.values(data);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

        const query = `
            INSERT INTO ${this.tableName} (${columns})
            VALUES (${placeholders})
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    async update(id, data) {
        const setClauses = Object.keys(data).map((key, index) => `${key} = $${index + 2}`);
        const values = [id, ...Object.values(data)];

        const query = `
            UPDATE ${this.tableName}
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    async delete(id) {
        const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = BaseModel;
