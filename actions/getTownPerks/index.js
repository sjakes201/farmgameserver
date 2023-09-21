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
            T.townName, T.growthPerkLevel, T.partsPerkLevel, T.orderRefreshLevel, t.animalPerkLevel
        FROM 
            Profiles P
        INNER JOIN 
            Towns T ON P.townID = T.townID
        WHERE 
            P.UserID = ${UserID};
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





