console.log('Server.js is starting...');
require('dotenv').config();

const tempAuth = require('./actions/tempAuth/index')


const { handleAction } = require('./actionHandler')

// Other imports
const url = require('url');
const jwt = require('jsonwebtoken');

// Run mainBot and scheduleTasks
const mainBot = require('./discordBot/mainBot');
const scheduleTasks = require('./cronJobs');

let connectedUsers = [];
// testing

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

function decodeUserID(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY);
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

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

setInterval(() => {
  try {
    const FIVE_MINS = 5 * 60 * 1000;
    const now = Date.now();

    connectedUsers.forEach(user => {
      if (now - user.lastActive > FIVE_MINS) {
        console.log(`Disconnecting ${user.UserID}`)
        // Close the WebSocket connection for this user
        user.userWs.close(1000, 'Inactivity timeout');
      }
    });
  } catch (error) {
    console.log(error)
  }
}, 10000)

const broadcastToTown = async (townID, message, username, messageID) => {
  try {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.townID === townID) {
        client.send(JSON.stringify({
          type: 'town_message',
          newMessageInfo: {
            content: message,
            timestamp: Date.now(),
            username: username,
            messageID: messageID
          }
        }))
      }
    });
  } catch (error) {
    console.log(`ERROR broadcasting town message to townID ${townID}, message: ${message}`, error)
  }
}


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

const port = process.env.PORT || 8080

server.listen(port, () => {
  console.log('Listening on %d', server.address().port);
});

module.exports = { broadcastToTown }