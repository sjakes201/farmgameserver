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

        let acceptQuery = await request.query(`
        DECLARE @targetUserID INT;
        SELECT @targetUserID = UserID FROM Logins WHERE Username = @targetUsername 

        IF @targetUserID IS NOT NULL
        BEGIN
            UPDATE Friends SET acceptedFlag = 1 WHERE
            receiverUserID = @UserID AND
            senderUserID = @targetUserID
        END
        `) 

        return {
            success: acceptQuery.rowsAffected[1] === 1
        }

    } catch (error) {
        console.log(error);
        return {
            message: "Uncaught error"
        };
    }
}





