const BaseModel = require('./BaseModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class User extends BaseModel {
    constructor() {
        super('users');
    }

    async findByEmail(email) {
        const query = `SELECT * FROM ${this.tableName} WHERE email = $1`;
        const result = await this.pool.query(query, [email]);
        return result.rows[0];
    }

    async createUser(userData) {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);

        // Create user without password
        const { ...userWithoutPassword } = userData;
        const user = await this.create({
            ...userWithoutPassword,
            password_hash: hashedPassword,
        });

        return this.generateAuthToken(user);
    }

    async authenticate(email, password) {
        const user = await this.findByEmail(email);

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        return this.generateAuthToken(user);
    }

    generateAuthToken(user) {
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRATION }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
            },
        };
    }

    async updatePassword(userId, currentPassword, newPassword) {
        const user = await this.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            throw new Error('Current password is incorrect');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await this.update(userId, { password_hash: hashedPassword });
    }

    async updateLastLogin(userId) {
        await this.update(userId, { last_login_at: new Date() });
    }
}

module.exports = new User();
