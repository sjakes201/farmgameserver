const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    // GET USERID
    const UserID = ws.UserID;
    const unlockID = actionData.unlockID;

    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.multiple = true;

        request.input('UserID', sql.Int, UserID);
        request.input('unlockID', sql.Int, unlockID);

        let hasUnlocked = await request.query(`
            UPDATE Profiles
            SET profilePic = u.UnlockName
            FROM Profiles p
            INNER JOIN Unlocks u ON p.UserID = @UserID AND u.UnlockID = @UnlockID
            LEFT JOIN UserUnlocks uu ON p.UserID = uu.UserID AND u.UnlockID = uu.UnlockID
            WHERE (p.UserID = @UserID) AND (uu.UnlockID IS NOT NULL OR u.Type = 'default');
        `)
        return {
            message: "SUCCESS"
        }

    } catch (error) {
        console.log(error);
        return {
            message: 'Uncaught internal error'
        };
    }


}





