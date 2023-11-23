const { getWebSocket } = require('./webSocketInstance');
const WebSocket = require('ws');

const sql = require('mssql');
const { poolPromise } = require('./db');


const broadcastToTown = async (townID, message, username, messageID, msgType, requestID) => {
    const wss = getWebSocket();
    try {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.townID === townID) {
                client.send(JSON.stringify({
                    type: 'town_message',
                    newMessageInfo: {
                        content: message,
                        timestamp: Date.now(),
                        username: username,
                        messageID: messageID,
                        requestID: requestID,
                        Type: msgType
                    }
                }))
            }
        });
    } catch (error) {
        console.log(`ERROR broadcasting town message to townID ${townID}, message: ${message}`, error)
    }
}

const townServerBroadcast = async (townID, messageContent, msgType) => {
    try {
        let connection = await poolPromise;

        let msgRequest = new sql.Request(connection)
        msgRequest.input('townID', sql.Int, townID)
        msgRequest.input('senderID', sql.Int, 0)
        msgRequest.input('messageContent', sql.NVarChar(512), messageContent)
        msgRequest.input('msgType', sql.NVarChar(32), msgType)
        let createBroadcast = await msgRequest.query(`
                DECLARE @InsertedIDs TABLE (ID INT);
                
                INSERT INTO TownMessages (townID, senderID, content, Type)
                OUTPUT INSERTED.messageID INTO @InsertedIDs
                VALUES (@townID, @senderID, @messageContent, @msgType);
                
                SELECT ID AS insertedMessageID FROM @InsertedIDs
            `)
        broadcastToTown(townID, messageContent, 'Server', createBroadcast.recordset[0].insertedMessageID, msgType, null)
    } catch (error) {
        console.log(error)
    }
}

const sendUserData = async (UserID, dataType, data) => {
    const wss = getWebSocket();
    try {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.UserID === UserID) {
                client.send(JSON.stringify({
                    type: 'data_update',
                    dataType: dataType,
                    data: data
                }))
            }
        });
    } catch (error) {
        console.log(`ERROR sending user data`, error)
    }
}

const sendTownUsersData = async (townID, dataType, data) => {
    const wss = getWebSocket();
    try {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.townID === townID) {
                let clientTownID = client?.townID;
                if (clientTownID === townID) {
                    client.send(JSON.stringify({
                        type: 'data_update',
                        dataType: dataType,
                        data: data
                    }))
                }
            }
        })
    } catch (error) {
        console.log(`ERROR sending town users data`, error)
    }

}

module.exports = { broadcastToTown, townServerBroadcast, sendUserData, sendTownUsersData };
