const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO');

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
        nameRequest.input('townName', sql.VarChar(32), townName)
        let nameQuery = await nameRequest.query(`SELECT townID FROM Towns WHERE townName = @townName`)
        if (nameQuery.recordset.length === 0) {
            return {
                message: `No town goes by name ${townName}`
            };
        }
        let townID = nameQuery.recordset[0].townID;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`townID`, sql.Int, townID);


        // Check profiles for existing townID and set to new (SQL +Profiles)
        let changeTownQuery = await request.query(`
         SELECT townID FROM Profiles WHERE UserID = @UserID
         UPDATE Profiles SET townID = @townID WHERE UserID = @UserID
         `)
        if (changeTownQuery.recordset[0].townID !== -1) {
            await transaction.rollback();
            return {
                message: "Already in a town, leave before joining a new one"
            };
        }

        // Check for open status, increment memberCount, set townContributions (SQL -Profiles +-Towns +TownContributions)
        let memberCountQuery = await request.query(`
        UPDATE Towns SET memberCount = memberCount + 1 WHERE townID = @townID
        SELECT memberCount, status FROM Towns WHERE townID = @townID
        UPDATE TownContributions SET townID = @townID WHERE UserID = @UserID
        `)
        if (memberCountQuery.recordset[0].memberCount > TOWNINFO.VALUES.townMemberLimit || memberCountQuery.recordset[0].status !== 'OPEN') {
            await transaction.rollback();
            return {
                message: `Town at capacity or closed to new members`
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





