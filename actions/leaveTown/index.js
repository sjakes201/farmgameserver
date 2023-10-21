const sql = require('mssql');
const { poolPromise } = require('../../db');
const { townServerBroadcast } = require('../../broadcastFunctions')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        let preRequest = new sql.Request(connection)
        preRequest.multiple = true;
        preRequest.input('UserID', sql.Int, UserID)

        let preData = await preRequest.query(`
            SELECT Username FROM Logins WHERE UserID = @UserID
            SELECT townID FROM TownMembers WHERE UserID = @UserID
        `)
        if (preData.recordsets[1].length === 0) {
            return {
                message: "Not in a town"
            }
        }
        let earlyTownID = preData.recordsets[1][0].townID;
        let username = preData.recordsets[0][0].Username

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`earlyTownID`, sql.Int, earlyTownID)

        // Decrement town member count (SQL +Towns)
        let memberCountQuery = await request.query(`
        UPDATE Towns SET memberCount = memberCount - 1 WHERE townID = @earlyTownID
        SELECT memberCount FROM Towns WHERE townID = @earlyTownID
        `)
        // SQL -Towns +TownMembers
        let myRoleQuery = await request.query(`
        SELECT RoleID, townID FROM TownMembers WHERE UserID = @UserID
        `)
        let myRoleID = myRoleQuery.recordset?.[0]?.RoleID;
        let myTownID = myRoleQuery.recordset?.[0]?.townID;
        let numMembers = memberCountQuery.recordset[0].memberCount;

        if (myTownID !== earlyTownID) {
            await transaction.rollback();
            return {
                message: "Town operation sync issue"
            };
        }

        if (myRoleID === 4 && numMembers > 0) {
            await transaction.rollback();
            return {
                message: "Must promote new leader before leaving nonempty town"
            };
        }
        let profileTownQuery = await request.query(`
            DELETE FROM TownMembers WHERE UserID = @UserID
        `)
        // If last person and leader, delete town goals (SQL -TownMembers +TownGoals)
        if (myRoleID === 4 && numMembers === 0) {
            await request.query(`
                DELETE FROM TownGoals WHERE townID = @earlyTownID
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
        townServerBroadcast(myTownID, `${username} has left the town.`)

        if (myRoleID === 4 && numMembers === 0) {
            // They are the last person. Delete the town (outside transaction)
            await connection.query(`
                DELETE FROM Towns WHERE townID = ${earlyTownID}
            `)
        }
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





