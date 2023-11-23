const sql = require('mssql');
const { poolPromise } = require('../../db');
const { townServerBroadcast } = require('../../broadcastFunctions')

module.exports = async function (ws, actionData) {
    // Currently only promotes to leader as there are no intermediary roles

    const UserID = ws.UserID;
    let targetUser = actionData.targetUser;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`targetUser`, sql.VarChar(32), targetUser)

        // Get new user UserID (SQL +Logins)
        let targetUserIDQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @targetUser
        `)
        if (targetUserIDQuery.recordset.length === 0) {
            await transaction.rollback();
            return {
                message: 'Attempted to promote user that does not exist'
            };
        }
        let targetID = targetUserIDQuery.recordset[0].UserID;
        request.input(`targetID`, sql.Int, targetID)
        request.multiple = true;
        // Check both your townids and roles (SQL -Logins +TownMembers)
        let inTownQuery = await request.query(`
            SELECT townID, RoleID FROM TownMembers WHERE UserID = @targetID
            SELECT townID, RoleID FROM TownMembers WHERE UserID = @UserID
        `)
        let targetInfo = inTownQuery?.recordsets?.[0]?.[0];
        let userInfo = inTownQuery?.recordsets?.[1]?.[0];
        if (!targetInfo || !userInfo) {
            await transaction.rollback();
            return {
                message: "You and promotion target are not both in towns"
            }
        }
        if (targetInfo.townID !== userInfo.townID) {
            await transaction.rollback();
            return {
                message: `${targetUser} is not in the same town as you`
            };
        }
        if(targetInfo.RoleID === 1) {
            await transaction.rollback();
            return {
                message: "User is already lowest role"
            }
        }
        if (userInfo.RoleID > targetInfo.RoleID) {
            // Can promote, not transferring leader
            let promoQuery = await request.query(`
                UPDATE TownMembers SET RoleID = RoleID - 1 WHERE UserID = @targetID
            `)
            await transaction.commit();
            const roles = ["member", "elder", "co-leader", "leader"];
            townServerBroadcast(targetInfo.townID, `${targetUser} has been demoted to ${roles[targetInfo.RoleID-2]}.`, 'SERVER_NOTIFICATION')
            return {
                message: "SUCCESS, demoted"
            }
        } else {
            await transaction.rollback();
            return {
                message: "Do not have auth to demote this user to this role"
            }
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }

}
