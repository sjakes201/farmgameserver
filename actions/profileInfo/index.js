const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    // GET USERID
    const UserID = ws.UserID;


    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        request.multiple = true;
        let allInfo = await request.query(`
        UPDATE Logins SET LastSeen = ${Date.now()} WHERE UserID = @UserID
        SELECT Username FROM Logins WHERE UserID = @UserID;
        SELECT * FROM AnimalManagement WHERE UserID = @UserID;
        SELECT Balance, XP FROM Profiles WHERE UserID = @UserID;
        SELECT * FROM Upgrades WHERE UserID = @UserID;
        SELECT * FROM Inventory_PRODUCE WHERE UserID = @UserID;
        SELECT * FROM LeaderboardSum WHERE UserID = @UserID
        `);

        let allProfile = {
            ...allInfo.recordsets[0][0],
            ...allInfo.recordsets[1][0],
            ...allInfo.recordsets[2][0],
            ...allInfo.recordsets[3][0],
            ...allInfo.recordsets[4][0],
            ...allInfo.recordsets[5][0],
        }

        delete allProfile.UserID


        if (allInfo.recordset.length === 0) {
            return {
                message: 'Profile with that UserID does not exist'
            };
        }
        return allProfile;
    } catch (error) {
        console.log(error);
        return {
            message: 'Database connection failed'
        };
    }


}





