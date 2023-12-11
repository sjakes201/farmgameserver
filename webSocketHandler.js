const { decodeUserID } = require('./utils');
const tempAuth = require('./actions/tempAuth/index');
const { handleAction } = require('./actionHandler');
const logUserIP = require('./serverActions/logUserIP/index');
const checkIPInfo = require('./serverActions/checkIPInfo/index');
const url = require('url');
const { checkMessageRateLimit } = require('./messageLimitChecker');

let connectedUsers = [];

function setupWebSocket(wss) {
    wss.on('connection', async (ws, req) => {
        try {
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            let ipv4 = clientIp.split(":")[0];
            const banned = await checkIPInfo(ipv4);

            if (banned) {
                console.log(`Banned IP ${clientIp} attempted to connect`);
                ws.close(4001, 'Banned IP');
                return;
            }

            const parameters = url.parse(req.url, true);
            const token = parameters.query.token;

            let userData = decodeUserID(token);
            if (userData.auth) {
                ws.UserID = userData.UserID;
            } else {
                let guestInfo = await tempAuth(ws, { "ipv4": ipv4 })
                if (guestInfo.auth && guestInfo.token) {
                    userData = decodeUserID(guestInfo.token);
                    if (userData.auth) {
                        ws.UserID = userData.UserID;
                        ws.send(JSON.stringify({
                            type: 'guest_auth',
                            token: guestInfo.token
                        }));
                    } else {
                        // This means there was an error while generating the guest token. Handle this error as required.
                        ws.close(1008, 'Error generating guest token');
                        return;
                    }
                } else {
                    // This means there was an error while generating the guest account. Handle this error as required.
                    ws.close(1008, 'Error generating guest account');
                    return;
                }
            }


            try {
                logUserIP(ws.UserID, ipv4);
            } catch (error) {
                console.log(error);
            }

            if (connectedUsers.every((obj) => obj.UserID !== ws.UserID)) {
                console.log(`Client UserID ${ws.UserID} connected`);
                connectedUsers.push({
                    UserID: ws.UserID,
                    connectedAt: Date.now(),
                    lastActive: Date.now(),
                    userWs: ws
                })
            } else {
                console.log(`Client UserID ${ws.UserID} reconnected`);
            }

            ws.on('message', async (message) => {
                try {
                    let user = connectedUsers.find(u => u.UserID === ws.UserID);
                    if (user) user.lastActive = Date.now()

                    if(checkMessageRateLimit(user.UserID)) {
                        ws.close(1008, "Server message rate limit")
                        return
                    }

                    const parsedMessage = JSON.parse(message);

                    const action = parsedMessage.action;
                    const MESSAGE_ID = parsedMessage.MESSAGE_ID;
                    const params = { ...parsedMessage }
                    delete params.action;
                    delete params.MESSAGE_ID;

                    handleAction(ws, MESSAGE_ID, action, params)

                } catch (error) {
                    console.log(error)
                }
            });

            ws.on('close', () => {
                console.log(`Client ${ws.UserID} disconnected`);
                connectedUsers = connectedUsers.filter((obj) => obj.UserID !== ws.UserID)
            });
        } catch (error) {
            console.log(error)
        }
    });
}

module.exports = {
    setupWebSocket
};
