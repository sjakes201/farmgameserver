const WebSocket = require('ws');

let wss = null;

function setWebSocket(wsInstance) {
    wss = wsInstance;
}

function getWebSocket() {
    return wss;
}

module.exports = { setWebSocket, getWebSocket };
