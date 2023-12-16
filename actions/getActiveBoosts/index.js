const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        request.multiple = true;
        let allInfo = await request.query(`
        SELECT PB.StartTime, BT.Duration, PB.BoostID, BT.BoostName, BT.Type, BT.BoostTarget, 'Player' AS Source
            FROM PlayerBoosts PB
            LEFT JOIN BoostTypes BT ON PB.BoostTypeID = BT.BoostTypeID
            WHERE UserID = @UserID AND PB.StartTime + BT.Duration > ${Date.now()};
        SELECT TB.StartTime, BT.Duration, TB.BoostID, BT.BoostName, BT.Type, BT.BoostTarget, 'Town' AS Source
            FROM TownMembers TM
            LEFT JOIN TownBoosts TB ON TM.townID = TB.townID
            LEFT JOIN BoostTypes BT ON TB.BoostTypeID = BT.BoostTypeID
            WHERE TM.UserID = @UserID AND TB.StartTime + BT.Duration > ${Date.now()};
        `);
        let activeBoosts = [...allInfo.recordsets[0], ...allInfo.recordsets[1]]

        return {
            success: true,
            activeBoosts: activeBoosts
        };
    } catch (error) {
        console.log(error);
        return {
            message: 'Database connection failed'
        };
    }


}





