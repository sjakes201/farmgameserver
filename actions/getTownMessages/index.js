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

            SELECT TOP 50 TM.content, TM.timestamp, Tm.messageID, L.Username
            FROM TownMessages TM
            INNER JOIN Logins L ON TM.senderID = L.UserID
            WHERE TM.townID = @TownID
            ORDER BY TM.timestamp DESC;

            SELECT @TownID AS userTownID, @LastSeenMessage as lastSeenMessage
        `)
        let userTownID = messages.recordsets[1][0].userTownID;
        if(userTownID) {
            return {
                messageHistory: messages.recordsets[0],
                userTownID: messages.recordsets[1][0].userTownID,
                lastSeenMessage: messages.recordsets[1][0].lastSeenMessage
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





