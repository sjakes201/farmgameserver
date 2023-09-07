const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let slot = actionData.slot;
    if (![1, 2, 3, 4, 5, 6].includes(slot)) {
        return {
            message: `Invalid slot: ${slot}`
        };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        const request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        let cancelQuery = await request.query(`UPDATE Machines SET Slot${slot}ProduceReceived = 0, Slot${slot}StartTime = -1 WHERE UserID = @UserID`)
    
        return  {
            message: "SUCCESS"
        };
    } catch (error) {
        console.log(error);
        return {
            message: 'UNCAUGHT ERROR IN /sellMachine endpoint'
        }

    } 
}
