const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let connection;
    try {
        connection = await poolPromise;
        let resultQuery = await connection.query(`
            SELECT TOP 10 
                T.townName, 
                T.townXP, 
                T.townLogoNum, 
                T.status, 
                (SELECT COUNT(*) FROM TownMembers TM WHERE TM.townID = T.townID) AS memberCount
            FROM Towns T
            ORDER BY T.townXP DESC;
            `)
        let data = resultQuery.recordset;

        return {
            townArray: data
        }

    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





