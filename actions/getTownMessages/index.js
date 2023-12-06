const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;

        const request = new sql.Request(connection);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID)
        let messages = await request.query(`
            DECLARE @TownID INT
            DECLARE @LastSeenMessage INT
            
            SELECT @TownID = townID, @LastSeenMessage = lastSeenMessage FROM TownMembers WHERE UserID = @UserID;
            
            SELECT TOP 50 
                TM.content, 
                TM.timestamp, 
                TM.messageID,
                TM.Type,
                CASE 
                    WHEN TM.senderID = 0 THEN 'Server'
                    ELSE L.Username
                END AS Username
            FROM TownMessages TM
            LEFT JOIN Logins L ON TM.senderID = L.UserID
            WHERE TM.townID = @TownID AND Type != 'TOWN_BROADCAST' AND Type != 'GOAL_COMPLETE'
            ORDER BY TM.timestamp DESC;

            SELECT TOP 20 
                TM.content, 
                TM.timestamp, 
                TM.messageID,
                TM.Type,
                CASE 
                    WHEN TM.senderID = 0 THEN 'Server'
                    ELSE L.Username
                END AS Username
            FROM TownMessages TM
            LEFT JOIN Logins L ON TM.senderID = L.UserID
            WHERE TM.townID = @TownID AND Type = 'TOWN_BROADCAST'
            ORDER BY TM.timestamp DESC;

            SELECT @TownID AS userTownID, @LastSeenMessage as lastSeenMessage

            SELECT TJR.requestTime, TJR.requestID, L.Username 
            FROM TownJoinRequests TJR 
            LEFT JOIN Logins L on TJR.UserID = L.UserID
            WHERE targetTownID = @TownID

            SELECT TOP 1 
                TM.content, 
                TM.timestamp, 
                TM.messageID,
                TM.Type,
                'Server' AS Username
            FROM TownMessages TM
            WHERE TM.townID = @TownID AND Type = 'GOAL_COMPLETE'
            ORDER BY TM.timestamp DESC;
        `)
        let announcements = messages.recordsets[1]
        let goalComplete = messages.recordsets[4]

        let result = [...messages.recordsets[0], ...announcements, ...goalComplete];

        messages.recordsets?.[3]?.forEach(joinReq => {
            result.unshift({
                content: `${joinReq.Username} has requested to join the town`,
                timestamp: joinReq.requestTime,
                requestID: joinReq.requestID,
                Type: 'TOWN_JOIN_REQUEST',
                Username: 'Server'
            })
        });

        let userTownID = messages.recordsets[2][0].userTownID;
        if (userTownID) {
            return {
                messageHistory: result,
                userTownID: messages.recordsets[2][0].userTownID,
                lastSeenMessage: messages.recordsets[2][0].lastSeenMessage
            }
        } else {
            return {
                message: "ERROR: not in a town"
            }
        }

    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





