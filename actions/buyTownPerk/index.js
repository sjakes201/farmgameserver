const sql = require('mssql');
const { poolPromise } = require('../../db');
const { townServerBroadcast } = require('../../broadcastFunctions')
const { townPerkCost } = require('../shared/townHelpers')
const TOWNSHOP = require('../shared/TOWNSHOP')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const targetPerk = actionData.targetPerk;

    if (!(targetPerk in TOWNSHOP.perkCosts)) {
        return {
            success: false,
            message: `Invalid town perk '${targetPerk}'`
        }
    }
    let connection;
    let transaction;

    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        // Get user town and authority level, and towns current level (SQL +TownMembers)
        const initialInfo = await request.query(`
        SELECT 
            TM.RoleID, 
            TM.townID,
            TP.${targetPerk}
        FROM 
            TownMembers AS TM
        INNER JOIN 
            TownPurchases AS TP ON TM.townID = TP.townID
        WHERE 
            TM.UserID = @UserID;
        `)

        if (initialInfo.recordsets[0].length === 0) {
            await transaction.rollback();
            return {
                success: false,
                message: "User is not in a town"
            }
        }

        const userRoleID = initialInfo.recordsets[0][0].RoleID;

        if (userRoleID < 3) {
            await transaction.rollback();
            return {
                success: false,
                message: "You do not have the correct authority to make town purchases"
            }
        }

        const userTownID = initialInfo.recordsets[0][0].townID;
        const townPerkLevel = initialInfo.recordsets[0][0][targetPerk];
        const nextPerkLevelCost = townPerkCost(targetPerk, townPerkLevel + 1)
        request.input(`targetTownID`, sql.Int, userTownID);
        request.input(`purchaseCost`, sql.Int, nextPerkLevelCost);

        if (nextPerkLevelCost === -1) {
            await transaction.rollback();
            return {
                success: false,
                message: `Invalid perk purchase of ${targetPerk} level ${townPerkLevel + 1}`
            }
        }

        // Increase the level and deduct funds (SQL -TownMembers +TownPurchases)
        const buyLevel = await request.query(`
            UPDATE TownPurchases SET ${targetPerk} = ${targetPerk} + 1 WHERE townID = @targetTownID
            UPDATE TownPurchases SET townFunds = townFunds - @purchaseCost WHERE townID = @targetTownID
            SELECT townFunds FROM TownPurchases WHERE townID = @targetTownID
        `)

        const remainingFunds = buyLevel.recordset[0].townFunds;
        if(remainingFunds < 0) {
            await transaction.rollback();
            return {
                success: false,
                message: `Insufficient funds: ${targetPerk} level ${townPerkLevel + 1} costs ${nextPerkLevelCost}, town funds are ${remainingFunds + nextPerkLevelCost}`
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
