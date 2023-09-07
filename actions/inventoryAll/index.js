const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');

module.exports = async function (ws, actionData) {

    // GET USERID
    const UserID = ws.UserID;
    // QUERY DB 

    let connection;
    try {
        connection = await poolPromise;
        let seedQuery = await connection.query(`SELECT * FROM Inventory_SEEDS WHERE UserID = ${UserID}`);
        let produceQuery = await connection.query(`SELECT * FROM Inventory_PRODUCE WHERE UserID = ${UserID}`);
        let extraQuery = await connection.query(`SELECT * FROM Inventory_EXTRA WHERE UserID = ${UserID}`)

        delete seedQuery.recordset[0].UserID;
        delete produceQuery.recordset[0].UserID;
        delete extraQuery.recordset[0].UserID;


        return {
            ...seedQuery.recordset[0],
            ...produceQuery.recordset[0],
            ...extraQuery.recordset[0]
        };
    } catch (error) {
        console.log(error);
        return {
            message: "inventory all error"
        };
    }
}





