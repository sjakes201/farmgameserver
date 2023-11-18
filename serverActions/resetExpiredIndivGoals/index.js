const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../../actions/shared/TOWNINFO')

module.exports = async function (ws, actionData) {
    if (process.env.NODE_ENV === 'TESTING') {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }
    
    let connection;
    try {
        connection = await poolPromise;
        const request = new sql.Request(connection);

        request.input('now', sql.BigInt, Date.now());
        let resetExpiry = await request.query(`
            UPDATE itg
            SET 
                itg.UserID = NULL,
                itg.progress = 0,
                itg.Good = gq.Good,
                itg.Quantity = gq.Quantity,
                itg.Expiration = NULL
            FROM IndividualTownGoals itg
            CROSS JOIN (SELECT TOP 1 Good, Quantity FROM IndivGoalGoodsQuantities ORDER BY NEWID()) gq
            WHERE itg.Expiration < @now;
        `)
    } catch (error) {
        console.log(error);
    }
}
