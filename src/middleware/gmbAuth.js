const GoogleMyBusiness = require('../services/GoogleMyBusiness');
const logger = require('../utils/logger');

const gmbAuth = () => {
    return async (req, res, next) => {
        try {
            // Check if user has GMB access
            const hasGmbAccess = await GoogleMyBusiness.checkAccess(req.user.id);

            if (!hasGmbAccess) {
                return res.status(403).json({
                    error: 'GMB access required',
                    message: 'You need to authorize Google My Business access to use this feature',
                    action: 'authorize_gmb',
                    authUrl: await GoogleMyBusiness.getAuthUrl(req.user.id),
                });
            }

            next();
        } catch (error) {
            logger.error('GMB authorization error:', error);
            res.status(500).json({
                error: 'Failed to verify GMB access',
                details: error.message,
            });
        }
    };
};

module.exports = gmbAuth;
