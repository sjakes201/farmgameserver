const sql = require('mssql');
const { poolPromise } = require('../../db');
const jwt = require('jsonwebtoken');

module.exports = async function (ws, actionData) {

    // GET USER ID

    const UserID = ws.UserID;


    // GET USER DATA

    let connection;
    let request;
    try {
        connection = await poolPromise;
        request = connection.request();
        request.input('UserID', sql.Int, UserID);
        let barnResult = await request.query(`SELECT * FROM Animals WHERE UserID = @UserID AND 
            (Animal_type = 'cow' OR Animal_type = 'yak' OR Animal_type = 'sheep' OR Animal_type = 'goat' OR Animal_type = 'llama')`);
        let coopResult = await request.query(`SELECT * FROM Animals WHERE UserID = @UserID AND 
        (Animal_type = 'chicken' OR Animal_type = 'duck' OR Animal_type = 'quail' OR Animal_type = 'bees' OR Animal_type = 'ostrich' OR Animal_type = 'kiwi')`);
        return {
            barnResult: barnResult.recordset,
            coopResult: coopResult.recordset
        }

        return;
    } catch (error) {
        console.log(error);
        return {
            message: "DATABASE connection error in /allAnimals call"
        };
    } 
}





