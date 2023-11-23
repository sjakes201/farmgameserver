const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let UserID = ws.UserID;
    let messageContent = actionData.messageContent;
    let msgType = actionData.msgType;

    if (!(typeof messageContent === "string") || messageContent.length > 512) {
        return {
            message: "Invalid message, must be 512 chars max length string"
        }
    }
    if (!["PLAYER_CHAT", "TOWN_BROADCAST"].includes(msgType)) {
        return {
            message: "Invalid msgType"
        }
    }

    let connection;
    try {
        connection = await poolPromise;

        const request = new sql.Request(connection);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID)

        if (msgType === "TOWN_BROADCAST") {
            const roleCheckQuery = await request.query(`
                SELECT roleID FROM TownMembers WHERE UserID = @UserID;
            `);
            const roleID = roleCheckQuery.recordset[0]?.roleID;
            if (![3, 4].includes(roleID)) {
                return {
                    message: "Unauthorized to send TOWN_BROADCAST"
                };
            }
        }

        request.input('messageContent', sql.NVarChar(512), messageContent)
        request.input('msgType', sql.NVarChar(32), msgType)

        let insertMsgQuery = await request.query(`
        DECLARE @TownID INT
        SELECT Username FROM Logins WHERE UserID = @UserID

        SELECT @TownID = townID FROM TownMembers WHERE UserID = @UserID;

        DECLARE @InsertedIDs TABLE (ID INT);

        IF @TownID <> -1
        BEGIN
            INSERT INTO TownMessages (townID, senderID, content, Type)
            OUTPUT INSERTED.messageID INTO @InsertedIDs
            VALUES (@TownID, @UserID, @messageContent, @msgType);
            
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
                messageID: messageID,
                msgType: msgType
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





