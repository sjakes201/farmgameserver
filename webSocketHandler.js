const { decodeUserID } = require('./utils');
const tempAuth = require('./actions/tempAuth/index');
const { handleAction } = require('./actionHandler');
const url = require('url');

let connectedUsers = [];

function setupWebSocket(wss) {
    wss.on('connection', async (ws, req) => {
        try {
            const parameters = url.parse(req.url, true);
            const token = parameters.query.token;

            let userData = decodeUserID(token);
            if (userData.auth) {
                ws.UserID = userData.UserID;
            } else {
                let guestInfo = await tempAuth(ws)
                if (guestInfo.auth && guestInfo.token) {
                    userData = decodeUserID(guestInfo.token);
                    console.log(userData)
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

                    const parsedMessage = JSON.parse(message);

                    const action = parsedMessage.action;
                    const params = { ...parsedMessage }
                    delete params.action;

                    handleAction(ws, action, params)

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

    try {
        let intervalID = setInterval(() => {
            let connInfoString = '';
            connectedUsers.forEach((userObj) => {
                connInfoString += ` (${userObj.UserID} > LC: ${Math.round((Date.now() - userObj.connectedAt) / 1000 / 60)} mins | LA: ${Math.round((Date.now() - userObj.lastActive) / 1000)} secs) `
            })
            console.log(`
          \n
      [***** LIVE STATS *****]\n
      Currently connected users: ${connectedUsers.length}
      (UserID, session duration):
      ${connInfoString}
      [*****            *****]
      \n
          `)
        }, 30000)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    setupWebSocket
};
