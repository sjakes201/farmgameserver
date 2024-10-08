const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO');
const { townServerBroadcast, broadcastToTown } = require('../../broadcastFunctions')
const { giveUnlockID } = require('../../unlockFunctions')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let townName = actionData.townName;
    if (typeof townName !== 'string' || townName.length > 32) {
        return {
            message: "Invalid town name, must be string 32 chars max"
        };
    }


    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        // Get townID associated with the name, doing this before the transaction requires that towns cannot change names else edge case where the name changes before transaction starts
        let nameRequest = new sql.Request(connection);
        nameRequest.multiple = true;
        nameRequest.input('townName', sql.VarChar(32), townName)
        nameRequest.input('UserID', sql.Int, UserID)
        let preQuery = await nameRequest.query(`
        SELECT townID FROM Towns WHERE townName = @townName
        SELECT Username FROM Logins WHERE USerID = @UserID
        `)
        if (preQuery.recordsets[0].length === 0) {
            return {
                message: `No town goes by name ${townName}`
            };
        }
        let townID = preQuery.recordsets[0][0].townID;
        let username = preQuery.recordsets[1][0].Username;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`townID`, sql.Int, townID);

        // Check for opening (SQL +-Towns +TownMembers)
        request.multiple = true;
        let openTown = await request.query(`
            SELECT status FROM Towns WHERE townID = @townID
            SELECT COUNT(*) AS memberCount FROM TownMembers WHERE townID = @townID
        `)
        let memberCount = openTown.recordsets[1][0].memberCount;
        if (!Number.isInteger(memberCount)) {
            await transaction.rollback();
            return {
                message: `Error getting town member count`
            };
        }
        if (memberCount < TOWNINFO.VALUES.townMemberLimit && openTown.recordset[0].status === 'INVITE') {
            // SQL -TownsMembers +TownJoinRequests
            let changeTownQuery = await request.query(`
                SELECT townID FROM TownMembers WHERE UserID = @UserID;

                INSERT INTO TownJoinRequests (UserID, targetTownID)
                OUTPUT INSERTED.requestID
                VALUES (@UserID, @townID);
            `);
            const insertedRequestID = changeTownQuery.recordsets[1][0].requestID;

            if (changeTownQuery.recordset.length !== 0) {
                await transaction.rollback();
                return {
                    message: "Already in a town, leave before joining a new one"
                };
            }

            await transaction.commit();
            broadcastToTown(townID, `${username} has requested to join the town.`, 'Server', null, 'TOWN_JOIN_REQUEST', insertedRequestID)

            return {
                success: true,
                message: "SUCCESS"
            }
        }

        if (memberCount < TOWNINFO.VALUES.townMemberLimit && openTown.recordset[0].status === 'OPEN') {
            // Check for existing town membership and set to new (SQL -Towns +-TownMembers +TownContributions)
            // 1 is role id for member
            let changeTownQuery = await request.query(`
                SELECT townID FROM TownMembers WHERE UserID = @UserID
                INSERT INTO TownMembers (UserID, RoleID, townID) VALUES (@UserID, 1, @townID)
                UPDATE TownContributions SET townID = @townID WHERE UserID = @UserID
            `)
            if (changeTownQuery.recordset.length !== 0) {
                await transaction.rollback();
                return {
                    message: "Already in a town, leave before joining a new one"
                };
            }

            await transaction.commit();
            townServerBroadcast(townID, `${username} has joined the town!`, 'SERVER_NOTIFICATION')
            giveUnlockID(UserID, 9);
            return {
                success: true,
                message: "SUCCESS"
            }
        }

        await transaction.rollback();
        return {
            message: `Town at capacity or closed to new members`
        };

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }

}





