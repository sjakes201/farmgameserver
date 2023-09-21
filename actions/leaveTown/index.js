const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);

        // Set townID to -1 (default for no town) (SQL +Profiles)
        let profileTownQuery = await request.query(`
        SELECT townID FROM Profiles WHERE UserID = @UserID
        UPDATE Profiles SET townID = -1 WHERE UserID = @UserID
        `)
        if (profileTownQuery.recordset[0].townID === -1) {
            await transaction.rollback();
            return {
                message: "Not in a town"
            };
        }

        request.input('townID', sql.Int, profileTownQuery.recordset[0].townID)
        // Decrement town and check logic for if you are leader (SQL -Profiles +Towns)
        let memberCountQuery = await request.query(`
        SELECT leader, memberCount FROM Towns WHERE townID = @townID
        UPDATE Towns SET memberCount = memberCount - 1 WHERE townID = @townID
        `)
        if (memberCountQuery.recordset[0].leader === UserID && memberCountQuery.recordset[0].memberCount > 1) {
            await transaction.rollback();
            return {
                message: "Must promote new leader before leaving nonempty town"
            };
        }
        if (memberCountQuery.recordset[0].leader === UserID && memberCountQuery.recordset[0].memberCount === 1) {
            // They are the last person. Delete the town (SQL -Towns +TownGoals)
            await request.query(`
                DELETE FROM Towns WHERE townID = @townID
                DELETE FROM TownGoals WHERE townID = @townID
            `)
        }
        // reset contributions and townID in contributions (SQL -TownGoals +TownContributions)
        await request.query(`
            UPDATE TownContributions SET 
            townID = -1,
            progress_1 = 0, progress_2 = 0, progress_3 = 0, progress_4 = 0, progress_5 = 0, progress_6 = 0, progress_7 = 0, progress_8 = 0,
            unclaimed_1 = NULL, unclaimed_2 = NULL, unclaimed_3 = NULL, unclaimed_4 = NULL, unclaimed_5 = NULL, unclaimed_6 = NULL, unclaimed_7 = NULL, unclaimed_8 = NULL 
            WHERE UserID = @UserID
        `)
        await transaction.commit();
        return {
            message: "SUCCESS"
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





