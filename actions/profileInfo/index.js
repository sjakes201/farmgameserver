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
        SELECT Balance, XP, profilePic, premiumCurrency FROM Profiles WHERE UserID = @UserID;
        SELECT * FROM Upgrades WHERE UserID = @UserID;
        SELECT * FROM Inventory_PRODUCE WHERE UserID = @UserID;
        SELECT * FROM LeaderboardSum WHERE UserID = @UserID;
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

        let activeBoosts = [...allInfo.recordsets[6], ...allInfo.recordsets[7]]

        let allProfile = {
            ...allInfo.recordsets[0][0],
            ...allInfo.recordsets[1][0],
            ...allInfo.recordsets[2][0],
            ...allInfo.recordsets[3][0],
            ...allInfo.recordsets[4][0],
            ...allInfo.recordsets[5][0],
            activeBoosts: activeBoosts,
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





