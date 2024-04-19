const sql = require('mssql');
const { poolPromise } = require('../../db');
const reportInvalidAction = require('../../serverActions/reportInvalidAction/index.js');
const CONSTANTS = require('../shared/CONSTANTS');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const pfpName = actionData.pfpName;
    let page = actionData?.usi?.p;
    let validActionPage = page === "/shop";
    if(!validActionPage) {
        reportInvalidAction(UserID, "wrongActionPage");
    }

    let cost = CONSTANTS.pfpInfo[pfpName]?.cost;
    if(!cost) {
        return {
            success: false,
            message: `Invalid pfp name: ${pfpName}`
        }
    }

    let unlockID = CONSTANTS.pfpInfo[pfpName]?.unlockID;

    let connection;
    let transaction;

    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        
        request.input(`UserID`, sql.Int, UserID);
        request.input('cost', sql.Int, cost);
        request.input('unlockID', sql.Int, unlockID);
        
       let query = await request.query(`
            UPDATE Profiles SET premiumCurrency = premiumCurrency - @cost WHERE UserID = @UserID;
            SELECT premiumCurrency FROM Profiles WHERE UserID = @UserID;

            INSERT INTO UserUnlocks (UserID, UnlockID) VALUES (@UserID, @unlockID);
       `)

       let newBal = query.recordset[0].premiumCurrency;
       if (!newBal || newBal < 0) {
            await transaction.rollback();
            return {
                success: false,
                message: "Insufficient gold"
            }
       }

        
        await transaction.commit();
        return {
            success: true,
            pfpName: pfpName,
            cost: cost
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR in buyProfilePic"
        };
    }

}
