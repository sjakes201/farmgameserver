const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);

        let results = await request.query(`
            SELECT 
                u.UnlockID,
                u.Type, 
                CASE 
                    WHEN uu.UnlockID IS NOT NULL OR u.type = 'default' THEN u.UnlockName
                    ELSE NULL 
                END as UnlockName,
                CASE 
                    WHEN uu.UnlockID IS NOT NULL OR u.type = 'default' THEN u.Description
                    ELSE NULL 
                END as Description
            FROM 
                Unlocks u
            LEFT JOIN 
                UserUnlocks uu ON u.UnlockID = uu.UnlockID AND uu.UserID = @UserID
            WHERE 
                u.type != 'secret' OR (u.type = 'secret' AND uu.UnlockID IS NOT NULL)
        `)

        return {
            message: "SUCCESS",
            pfpInfos: results.recordset,
        }

    } catch (error) {
        console.log(error);
        return {
            message: 'Uncaught internal error'
        };
    }


}





