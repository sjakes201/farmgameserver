const { poolPromise } = require('../../db');
const sql = require('mssql');

module.exports = async function (UserID, IP) {

    let connection;
    try {
        console.log(`Received in logUserIP: UserID: ${typeof UserID} ${UserID} and IP: ${typeof IP} ${IP}`)
        connection = await poolPromise;
        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID)
        request.input('IP', sql.NVarChar(45), IP)
        await request.query(`
            INSERT INTO UserIPs (UserID, LoggedIP) VALUES (@UserID, @IP)
        `);
    } catch (error) {
    }


};





