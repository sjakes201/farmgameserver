const sql = require('mssql');
const { poolPromise } = require('../../db');
const BOOSTSINFO = require('../shared/BOOSTSINFO');
const { sendTownUsersData } = require('../../broadcastFunctions')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const boostName = actionData.boostName;
    if (!(boostName in BOOSTSINFO)) {
        return {
            success: false,
            message: `Invalid boost name: ${boostName}`
        }
    }

    let connection;
    let transaction;

    try {
        connection = await poolPromise;

        const request = new sql.Request(connection);
        request.input(`UserID`, sql.Int, UserID);
        request.input('boostName', sql.VarChar, boostName)

        let info = await request.query(`
            SELECT BoostTypeID FROM BoostTypes WHERE BoostName = @boostName
        `)
        const boostTypeID = info.recordset[0]?.BoostTypeID;
        if (!boostTypeID) {
            return {
                success: false,
                message: `Invalid boost name: ${boostName}`
            }
        }

        const boostCost = BOOSTSINFO[boostName].cost

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request2 = new sql.Request(transaction);
        request2.input(`UserID`, sql.Int, UserID);
        request2.input('boostCost', sql.Int, boostCost);
        request2.input('boostTypeID', sql.Int, boostTypeID);

        let buy = await request2.query(`
            INSERT INTO PlayerBoosts (UserID, BoostTypeID) VALUES (@UserID, @boostTypeID)
            UPDATE Profiles SET premiumCurrency = premiumCurrency - @boostCost WHERE UserID = @UserID
            SELECT premiumCurrency FROM Profiles WHERE UserID = @UserID
        `)

        let remainingCurrency = buy.recordset[0].premiumCurrency;
        if(!(remainingCurrency >= 0)) {
            await transaction.rollback();
            return {
                success: false,
                message: `Not enough premium currency`
            }
        }
        
        await transaction.commit();
        return {
            success: true
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }

}
