const express = require('express');
const http = require('http');

function setupExpressServer() {
    const app = express();
    const server = http.createServer(app);
    app.use(express.json({ limit: '2mb' }));

    // Set limit to 10mb for URL-encoded bodies
    app.use(express.urlencoded({ limit: '2mb', extended: true }));
    
    return { app, server };
}

module.exports = {
    setupExpressServer
};
