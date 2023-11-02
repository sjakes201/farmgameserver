const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const targetUsername = actionData.targetUsername;

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID)
        request.input('targetUsername', sql.NVarChar, targetUsername);

        let sendRequest = await request.query(`
        DECLARE @targetUserID INT;
        SELECT @targetUserID = UserID FROM Logins WHERE Username = @targetUsername;

        IF @targetUserID IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM Friends WHERE (senderUserID = @UserID AND receiverUserID = @targetUserID) OR (senderUserID = @targetUserID AND receiverUserID = @UserID))
            BEGIN
                INSERT INTO Friends (senderUserID, receiverUserID) VALUES (@UserID, @targetUserID);
            END
            ELSE
            BEGIN
                UPDATE Friends
                SET acceptedFlag = 0, senderUserID = @UserID, receiverUserID = @targetUserID
                WHERE (senderUserID = @UserID AND receiverUserID = @targetUserID) OR (senderUserID = @targetUserID AND receiverUserID = @UserID);
            END
        END
        `) 

        return {
            success: sendRequest.rowsAffected[0] === 1
        }

    } catch (error) {
        console.log(error);
        return {
            message: "Uncaught error"
        };
    }
}





