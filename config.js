require('dotenv').config();

module.exports = {
    JWT_KEY: process.env.JWT_KEY,
    PORT: process.env.PORT || 8080
};
