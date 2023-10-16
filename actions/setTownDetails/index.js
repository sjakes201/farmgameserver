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

        // Get your townID (outside transaction)
        let townIDQuery = await connection.query(`
        SELECT townID FROM TownMembers WHERE UserID = ${UserID}
        `)
        let yourTownID = townIDQuery?.recordset?.[0]?.townID
        if (!yourTownID) {
            await transaction.rollback();
            return {
                message: "You are not in a town"
            };
        }
        // Set description and check your role has auth to do so (SQL +-Towns +TownMembers)
        request.input('townID', sql.Int, yourTownID)
        let changeQuery = await request.query(`
            UPDATE Towns SET status = @newStatus, townDescription = @newDescription, townLogoNum = @newLogoNum WHERE townID = @townID
            SELECT RoleID FROM TownMembers WHERE UserID = @UserID
        `)
        let yourRoleID = changeQuery.recordset?.[0]?.RoleID;
        if(yourRoleID < 3) {
            await transaction.rollback();
            return {
                message: "PROHIBITED: You do not have authority in town"
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





