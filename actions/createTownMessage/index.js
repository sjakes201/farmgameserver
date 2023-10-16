const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let UserID = ws.UserID;
    let messageContent = actionData.messageContent;

    if (!(typeof messageContent === "string") || messageContent.length > 512) {
        return {
            message: "Invalid message, must be 512 chars max length string"
        }
    }

    let connection;
    try {
        connection = await poolPromise;

        const request = new sql.Request(connection);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID)
        request.input('messageContent', sql.NVarChar(512), messageContent)

        let insertMsgQuery = await request.query(`
        DECLARE @TownID INT
        SELECT Username FROM Logins WHERE UserID = @UserID

        SELECT @TownID = townID FROM TownMembers WHERE UserID = @UserID;

        DECLARE @InsertedIDs TABLE (ID INT);

        IF @TownID <> -1
        BEGIN
            INSERT INTO TownMessages (townID, senderID, content)
            OUTPUT INSERTED.messageID INTO @InsertedIDs
            VALUES (@TownID, @UserID, @messageContent);
            
            SELECT @TownID AS userTownID, ID AS insertedMessageID FROM @InsertedIDs
        END

        `)
        let username = insertMsgQuery.recordsets[0][0].Username;
        let userTownID = insertMsgQuery.recordsets[1][0].userTownID;
        let messageID = insertMsgQuery.recordsets[1][0].insertedMessageID;

        if (userTownID) {
            return {
                userTownID: userTownID,
                messageContent: messageContent,
                username: username,
                messageID: messageID
            }
        } else {
            return {
                message: "ERROR: user not in town"
            }
        }

    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





