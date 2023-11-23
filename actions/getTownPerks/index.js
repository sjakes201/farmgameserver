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
        let allInfo = await request.query(`
        SELECT 
            TM.roleID, T.townName, TP.cropTimeLevel, TP.animalTimeLevel, TP.partsChanceLevel, TP.orderRefreshLevel, TP.happinessMultiplierLevel
        FROM 
            TownMembers TM
        INNER JOIN 
            TownPurchases TP ON TM.townID = TP.townID
        INNER JOIN 
            Towns T on TM.townID = T.townID
        WHERE 
            TM.UserID = @UserID;
        `);

        if (allInfo.recordset.length === 0) {
            return {
                growthPerkLevel: 0,
                partsPerkLevel: 0,
                orderRefreshLevel: 0,
                animalPerkLevel: 0,
                townName: ""
            };
        }
        return allInfo.recordset[0];
    } catch (error) {
        console.log(error);
        return {
            message: 'Database connection failed'
        };
    }
}
