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
        if (userInfo.RoleID === 4 && targetInfo.RoleID === 3) {
            // transferring leadership
            // Can promote
            let promoQuery = await request.query(`
                UPDATE TownMembers SET RoleID = 4 WHERE UserID = @targetID
                UPDATE TownMembers SET RoleID = 3 WHERE UserID = @UserID
            `)
            await transaction.commit();
            townServerBroadcast(targetInfo.townID, `${targetUser} has been promoted to leader!`, 'SERVER_NOTIFICATION')
            return {
                message: "SUCCESS, leader transferred"
            }
        } else if (userInfo.RoleID > targetInfo.RoleID + 1) {
            // Can promote, not transferring leader
            let promoQuery = await request.query(`
                UPDATE TownMembers SET RoleID = RoleID + 1 WHERE UserID = @targetID
            `)
            await transaction.commit();
            const roles = ["member", "elder", "co-leader", "leader"];
            townServerBroadcast(targetInfo.townID, `${targetUser} has been promoted to ${roles[targetInfo.RoleID]}!`, 'SERVER_NOTIFICATION')
            return {
                message: "SUCCESS, promoted"
            }
        } else {
            await transaction.rollback();
            return {
                message: "Cannot promote this user to this role"
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
