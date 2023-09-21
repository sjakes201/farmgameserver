const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let kickedMember = actionData.kickedMember;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`kickedMember`, sql.VarChar(32), kickedMember)
        request.multiple = true;

        // Get UserID of kicked player (SQL +Logins)
        let kickedUserIDQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @kickedMember
        `)
        if (kickedUserIDQuery.recordset.length === 0) {
            await transaction.rollback();
            return  {
                message: 'Attempted to kick user that does not exist'
            };
        }
        let kickedUserID = kickedUserIDQuery.recordset[0].UserID;
        if(kickedUserID === UserID) {
            await transaction.rollback();
            return {
                message: "You cannot kick yourself out of a town, must use leave function"
            };
        }
        request.input(`kickedUserID`, sql.Int, kickedUserID)

        // Check that you are both in the town and set the victim to -1 townID (SQL -Logins +Profiles)
        let inTownQuery = await request.query(`
            SELECT townID FROM Profiles WHERE UserID = @kickedUserID
            SELECT townID FROM Profiles WHERE UserID = @UserID
            UPDATE Profiles SET townID = -1 WHERE UserID = @kickedUserID
        `)
        let kickedUserTownID = inTownQuery.recordsets[0][0].townID;
        let leaderTownID = inTownQuery.recordsets[1][0].townID;
        if (kickedUserTownID !== leaderTownID || kickedUserTownID === -1) {
            await transaction.rollback();
            return  {
                message: `${kickedMember} is not in the same town as you or is not in a town`
            };
        }

        // Check that you are the leader of the town, decrement member count, and reset the kicked user's town contributions (SQL -Profiles +-Towns +TownContributions)
        let updateTownQuery = await request.query(`
            UPDATE Towns SET memberCount = memberCount - 1 WHERE townID = ${leaderTownID}
            SELECT leader FROM Towns WHERE townID = ${leaderTownID}
            
            UPDATE TownContributions SET 
            townID = -1,
            progress_1 = 0, progress_2 = 0, progress_3 = 0, progress_4 = 0, progress_5 = 0, progress_6 = 0, progress_7 = 0, progress_8 = 0,
            unclaimed_1 = NULL, unclaimed_2 = NULL, unclaimed_3 = NULL, unclaimed_4 = NULL, unclaimed_5 = NULL, unclaimed_6 = NULL, unclaimed_7 = NULL, unclaimed_8 = NULL 
            WHERE UserID = @kickedUserID
        `)
        if (updateTownQuery.recordset[0].leader !== UserID) {
            await transaction.rollback();
            return  {
                message: "You are not the leader of this town"
            };
        }
        await transaction.commit();
        return {
            message: "SUCCESS"
        }


    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return  {
            message: "UNCAUGHT ERROR"
        };
    }
}





