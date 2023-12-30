const sql = require('mssql');
const { poolPromise } = require('../../db');
const BOOSTSINFO = require('../shared/BOOSTSINFO');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const boostID = actionData.boostID;

    let connection;
    let transaction;

    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input('boostID', sql.Int, boostID)

        const activeTime = Date.now();
        let enablePB = await request.query(`
            SELECT * FROM PlayerBoosts WHERE BoostID = @boostID AND UserID = @UserID
            UPDATE PlayerBoosts SET Activated = 1, StartTime = ${activeTime} WHERE BoostID = @boostID AND UserID = @UserID
        `)
        if(enablePB.recordset.length === 0 ) {
            await transaction.rollback();
            return {
                success: false,
                message: "Boost does not exist."
            }
        }
        if(enablePB.recordset[0].Activated) {
            await transaction.rollback();
            return {
                success: false,
                message: "Boost was already activated."
            }
        }
        
        await transaction.commit();
        return {
            success: true,
            activeTime: activeTime,
            boostID: boostID
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }

}
