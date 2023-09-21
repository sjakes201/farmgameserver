const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let newData = actionData.newData;

    if (typeof newData.description !== 'string' || newData.description.length > 128 || typeof newData.status !== 'string' || !['OPEN', 'CLOSED'].includes(newData.status) || !Number.isInteger(newData.logoNum)) {
        return {
            message: `Invalid setTownDetailsInputs`
        };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`newStatus`, sql.VarChar(16), newData.status)
        request.input(`newDescription`, sql.VarChar(128), newData.description)
        request.input(`newLogoNum`, sql.TinyInt, newData.logoNum)

        // Get your townID (SQL +Profiles)
        let townIDQuery = await request.query(`
        SELECT townID FROM Profiles WHERE UserID =@UserID
        `)
        let yourTownID = townIDQuery.recordset[0].townID
        if (yourTownID === -1) {
            await transaction.rollback();
            return {
                message: "You are not in a town"
            };
        }
        // Set description and check you are leader (SQL -Profiles +Towns)
        request.input('townID', sql.Int, yourTownID)
        let changeQuery = await request.query(`
            SELECT leader FROM Towns WHERE townID = @townID
            UPDATE Towns SET status = @newStatus, townDescription = @newDescription, townLogoNum = @newLogoNum WHERE townID = @townID
        `)
        let leaderUserID = changeQuery.recordset[0].leader;
        if (leaderUserID !== UserID) {
            await transaction.rollback();
            return {
                message: "Only the leader of this town can change the status"
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





