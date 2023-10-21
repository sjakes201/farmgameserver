const { JWT_KEY } = require('./config');
const jwt = require('jsonwebtoken');

function decodeUserID(token) {
    try {
        const decoded = jwt.verify(token, JWT_KEY);
        return {
            auth: true,
            UserID: decoded.UserID,
            message: 'Auth success'
        };
    } catch (e) {
        return {
            auth: false,
            UserID: -1,
            message: 'Authentication failure'
        };
    }
}

module.exports = {
    decodeUserID
};
