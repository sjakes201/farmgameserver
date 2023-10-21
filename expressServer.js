const express = require('express');
const http = require('http');

function setupExpressServer() {
    const app = express();
    const server = http.createServer(app);

    return { app, server };
}

module.exports = {
    setupExpressServer
};
