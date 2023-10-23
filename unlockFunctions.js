const sql = require('mssql');
const { poolPromise } = require('./db');

/**
 * Currently used to manually give unlockIDs 4, 9, 10, 11, 20
 * @param {Number} integer UserID who is unlocking
 * @param {Number} integer unlockID for the specific unlock 
 */
const giveUnlockID = async (UserID, unlockID) => {
    try {
        let connection = await poolPromise;
        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        request.input('UnlockID', sql.Int, unlockID)
        await request.query(`
            INSERT INTO UserUnlocks (UserID, UnlockID)
            SELECT @UserID, @UnlockID
            WHERE NOT EXISTS (
                SELECT 1
                FROM UserUnlocks
                WHERE UserID = @UserID AND UnlockID = @UnlockID
            );
        `)
    } catch (error) {
        console.log(error)
    }
}

module.exports = { giveUnlockID };
