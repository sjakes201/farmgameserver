const { poolPromise } = require('../../db'); 
const sql = require('mssql')

module.exports = async function () {

    if(process.env.NODE_ENV === "TESTING") {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection)
        request.input('twoDaysAgo', sql.BigInt, (Date.now() - 2 * 24 * 60 * 60 * 1000))
        await connection.query(`DELETE FROM TownJoinRequests WHERE requestTime <= @twoDaysAgo`);
    } catch (error) {
        console.log(error)
    }


};





