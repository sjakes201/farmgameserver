const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let connection;
    try {
        connection = await poolPromise;
        let resultQuery = await connection.query(`
            SELECT TOP 10 townName, townXP, townLogoNum, status, memberCount
            FROM Towns
            ORDER BY townXP DESC;
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





