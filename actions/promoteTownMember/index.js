const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {
    // Currently only promotes to leader as there are no intermediary roles
    
    const UserID = ws.UserID;

    let newLeader = actionData.newLeader;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`newLeader`, sql.VarChar(32), newLeader)

        // Get new user UserID (SQL +Logins)
        let newLeaderIDQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @newLeader
        `)
        if (newLeaderIDQuery.recordset.length === 0) {
            await transaction.rollback();
            return {
                message: 'Attempted to promote user that does not exist'
            };
        }
        let newLeaderID = newLeaderIDQuery.recordset[0].UserID;
        request.input(`newLeaderID`, sql.Int, newLeaderID)
        request.multiple = true;
        // Check that the new leader is in your town (SQL -Logins +Profiles)
        let inTownQuery = await request.query(`
            SELECT townID FROM Profiles WHERE UserID = @newLeaderID
            SELECT townID FROM Profiles WHERE UserID = @UserID
        `)
        let newLeaderTownID = inTownQuery.recordsets[0][0].townID;
        let oldLeaderTownID = inTownQuery.recordsets[1][0].townID;
        console.log(newLeaderTownID, oldLeaderTownID)
        if (newLeaderTownID !== oldLeaderTownID) {
            await transaction.rollback();
            return {
                message: `${newLeader} is not in the same town as you`
            };
        }

        // Set new leader (SQL -Profiles +Towns)
        // Since users can only one town, transfer based on what that leader owns, not the t
        let newLeaderQuery = await request.query(`
            SELECT leader FROM Towns WHERE townID = ${oldLeaderTownID}
            UPDATE Towns SET leader = @newLeaderID WHERE townID = ${oldLeaderTownID} 
            UPDATE TownMembers set RoleID = 4 WHERE UserID = ${newLeaderTownID}
        `)
        console.log(newLeaderQuery)
        if (newLeaderQuery.recordset[0].leader !== UserID) {
            await transaction.rollback();
            return {
                message: "You do not own a town to transfer leadership of"
            };
        }
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
