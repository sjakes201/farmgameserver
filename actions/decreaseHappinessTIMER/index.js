const sql = require('mssql');

module.exports = async function (context, myTimer) {

    if(process.env.NODE_ENV === "testing") {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }

    let connection;
    try {
        connection = await poolPromise;
        await connection.query(`UPDATE Animals SET Happiness = Happiness - 0.005 WHERE Happiness > 0`);
    } catch (error) {
        console.log(error)
    } finally {
        if(connection) connection.close()
    }


};





