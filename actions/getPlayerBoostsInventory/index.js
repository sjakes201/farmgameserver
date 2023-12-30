const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        let allInfo = await request.query(`
        SELECT PB.StartTime, BT.Duration, PB.BoostID, BT.BoostName, BT.Type, BT.BoostTarget, 'Player' AS Source
            FROM PlayerBoosts PB
        LEFT JOIN BoostTypes BT ON PB.BoostTypeID = BT.BoostTypeID
        WHERE UserID = @UserID AND PB.Activated = 0
        `);

        return {
            success: true,
            boosts: allInfo.recordset
        };
    } catch (error) {
        console.log(error);
        return {
            message: 'Database connection failed'
        };
    }


}





