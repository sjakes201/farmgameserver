const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');

module.exports = async function (ws, actionData) {
    // GET USERID
    const UserID = ws.UserID;


    // QUERY DB 
    let connection;
    try {
        connection = await poolPromise;
        let earliestTime = Date.now() - CONSTANTS.VALUES.TimeFeritilizeDuration;
        // give 2.5 extra minutes so crops don't go backwards for just init
        earliestTime -= 2.5 * 60 * 1000;
        let result = await connection.query(`
        UPDATE CropTiles SET TimeFertilizer = -1 WHERE TimeFertilizer < ${earliestTime} AND UserID = ${UserID}
        SELECT * FROM CropTiles WHERE UserID = ${UserID}
        `);
        for (let i = 0; i < result.recordset.length; ++i) {
            delete result.recordset[i].UserID
        }
        return result.recordset
    } catch (error) {
        console.error("/all endpoint error: ", error);
        return {
            message: error
        };
    }
}





