const sql = require('mssql');
const { poolPromise } = require('../../db'); 
const { townServerBroadcast, sendUserData } = require('../../broadcastFunctions')

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

        // Check that you are both in the town (outside transaction)
        let inTownQuery = await connection.query(`
            SELECT townID, RoleID FROM TownMembers WHERE UserID = ${kickedUserID}
            SELECT townID, RoleID FROM TownMembers WHERE UserID = ${UserID}
        `)
        let kickedUserTownID = inTownQuery?.recordsets?.[0]?.[0]?.townID;
        let yourTownID = inTownQuery?.recordsets?.[1]?.[0]?.townID;

        let kickedUserRoleID = inTownQuery?.recordsets?.[0]?.[0]?.RoleID;
        let yourRoleID = inTownQuery?.recordsets?.[1]?.[0]?.RoleID;

        if(yourRoleID <= kickedUserRoleID) {
            await transaction.rollback();
            return {
                message: "You cannot kick this user!"
            }
        }

        if(!kickedUserTownID || !yourTownID || !yourRoleID || !kickedUserRoleID) {
            await transaction.rollback();
            return {
                message: "Internal error: you or kick target are not both in towns"
            }
        }
        if (kickedUserTownID !== yourTownID) {
            await transaction.rollback();
            return  {
                message: `${kickedMember} is not in the same town as you or is not in a town`
            };
        }
        request.input('yourTownID', sql.Int, yourTownID)
        // Decrement member count, and reset the kicked user's town contributions (SQL -Logins +-TownMembers +TownContributions)
        let updateTownQuery = await request.query(`          
            DELETE FROM TownMembers WHERE UserID = @kickedUserID

            UPDATE TownContributions SET 
            townID = -1,
            progress_1 = 0, progress_2 = 0, progress_3 = 0, progress_4 = 0, progress_5 = 0, progress_6 = 0, progress_7 = 0, progress_8 = 0,
            unclaimed_1 = NULL, unclaimed_2 = NULL, unclaimed_3 = NULL, unclaimed_4 = NULL, unclaimed_5 = NULL, unclaimed_6 = NULL, unclaimed_7 = NULL, unclaimed_8 = NULL 
            WHERE UserID = @kickedUserID
        `)
        await transaction.commit();
        townServerBroadcast(yourTownID, `${kickedMember} has been kicked from the town.`, 'SERVER_NOTIFICATION')
        sendUserData(kickedUserID, "TOWN_CHANGE", { })

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





