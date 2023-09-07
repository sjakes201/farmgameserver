const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;


    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID)

        let lbPositionsQuery = await request.query(`SELECT * FROM Leaderboard WHERE UserID = @UserID`)
        let totalsQuery = await request.query(`SELECT * FROM LeaderboardSum WHERE UserID = @UserID`)
        let numPlayersQuery = await connection.query(`SELECT COUNT(*) FROM Leaderboard`);

        let totalPlayers = numPlayersQuery.recordset[0]['']

        // get totals from LeaderboardSum
        // get positions from Leaderboard

        delete lbPositionsQuery.recordset[0].UserID
        delete lbPositionsQuery.recordset[0].Username
        delete totalsQuery.recordset[0].UserID

        let positions = lbPositionsQuery.recordset[0]
        let totals = totalsQuery.recordset[0];

        let allPKeys = Object.keys(positions);
        for (let i = 0; i < allPKeys.length; ++i) {
            if (positions[allPKeys[i]] === -1) {
                positions[allPKeys[i]] = totalPlayers;
            }
        }

        return {
            totals: { ...totals },
            lbPositions: { ...positions }
        };

    } catch (error) {
        console.log(error)
        return  {
            message: 'unable to fetch user stats'
        }
    }
}





