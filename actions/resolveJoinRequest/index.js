const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO');
const { sendTownUsersData, townServerBroadcast, sendUserData } = require('../../broadcastFunctions')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let requestID = actionData.requestID;
    let isAccepted = actionData.isAccepted;

    if (!Number.isInteger(requestID) || typeof isAccepted !== 'boolean') {
        return {
            message: "Invalid resolveJoinRequestInputs"
        };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        const request = new sql.Request(connection);
        request.multiple = true;
        request.input('requestID', sql.Int, requestID)
        request.input('UserID', sql.Int, UserID)

        if(!isAccepted) {
            let deleteQuery = await request.query(`
                SELECT targetTownID FROM TownJoinRequests WHERE requestID = @requestID
                DELETE FROM TownJoinRequests WHERE requestID = @requestID
            `)
            let targetTownID = deleteQuery.recordset[0].targetTownID
            sendTownUsersData(targetTownID, "TOWN_JOIN_RESOLVE", {
                requestID: requestID,
                isAccepted: isAccepted
            })
            return {
                message: "SUCCESS"
            }
        }

        let targetUserQuery = await request.query(`
            SELECT * FROM TownJoinRequests WHERE requestID = @requestID
            SELECT RoleID FROM TownMembers WHERE UserID = @UserID
        `)
        if(targetUserQuery.recordsets?.[1]?.[0]?.RoleID < 3) {
            return {
                message: "PROHIBITED: You do not have authority in town"
            };
        }

        let targetUserID = targetUserQuery.recordsets?.[0]?.[0]?.UserID
        let targetTownID = targetUserQuery.recordsets?.[0]?.[0]?.targetTownID

        if(!targetTownID) {
            return {
                success: false,
                message: 'EXPIRED: Pending join request no longer exists'
            }
        }

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        let requestTran = new sql.Request(transaction);
        request.multiple = true;
        requestTran.input(`targetUserID`, sql.Int, targetUserID);
        requestTran.input(`targetTownID`, sql.Int, targetTownID)
        let inTown = await requestTran.query(`
            SELECT townID FROM TownMembers WHERE UserID = @targetUserID
            SELECT COUNT(*) as currentMemberCount FROM TownMembers WHERE townID = @targetTownID
            INSERT INTO TownMembers (UserID, roleID, townID) VALUES (@targetUserID, 1, @targetTownID)
            DELETE FROM TownJoinRequests WHERE UserID = @targetUserID
            SELECT Username FROM Logins WHERE UserID = @targetUserID
        `)
        if (inTown.recordsets[0].length > 0) {
            await transaction.rollback();
            return {
                message: "User has already joined a town"
            };
        }
        if (inTown.recordsets[1].currentMemberCount >= TOWNINFO.VALUES.townMemberLimit) {
            await transaction.rollback();
            return {
                message: "Town is full"
            };
        }

        await transaction.commit();
        sendTownUsersData(targetTownID, "TOWN_JOIN_RESOLVE", {
            requestID: requestID,
            isAccepted: isAccepted
        })
        townServerBroadcast(targetTownID, `${inTown.recordsets?.[2]?.[0]?.Username}'s request to join has been accepted.`, 'SERVER_NOTIFICATION')
        sendUserData(targetUserID, "TOWN_CHANGE", { })
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





