const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;

        const request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID)
        request.input('messageID', sql.Int, actionData.messageID)
        await request.query(`
            UPDATE TownMembers SET lastSeenMessage = @messageID WHERE UserID = @UserID
        `)
        return {
            message: "SUCCESS"
        }

    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





