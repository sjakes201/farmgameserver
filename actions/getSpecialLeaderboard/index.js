const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection)

        // for new players, is total num of players (tied for last)
        let getData = await request.query(`
            SELECT L.Username, LB.special1 AS position, LBS.special1 AS count

            FROM Leaderboard LB
            LEFT JOIN LeaderboardSum LBS ON LB.UserID = LBS.UserID
            LEFT JOIN Logins L ON LB.UserID  = L.UserID
            WHERE LB.special1 <= 10 AND LB.special1 >= 1
        `);

        return {
            success: true,
            data: getData.recordset
        }
    } catch (error) {
        console.log(error)
        return {
            success: false,
            message: "Uncaught error in getSpecialLeaderboard"
        }
    }
}





