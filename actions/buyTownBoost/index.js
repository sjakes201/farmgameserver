const sql = require('mssql');
const { poolPromise } = require('../../db');
const BOOSTSINFO = require('../shared/BOOSTSINFO');
const { sendTownUsersData } = require('../../broadcastFunctions')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const boostName = actionData.boostName;

    if (!(boostName in BOOSTSINFO.townBoostsInfo)) {
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
        request.multiple = true;
        request.input(`UserID`, sql.Int, UserID);
        request.input('boostName', sql.VarChar, boostName)

        let info = await request.query(`
            SELECT townID, RoleID FROM TownMembers WHERE UserID = @UserID
            SELECT BoostTypeID FROM BoostTypes WHERE BoostName = @boostName
        `)
        if (info.recordsets?.[0]?.length === 0) {
            return {
                success: false,
                message: "User not in a town"
            }
        }
        let townID = info.recordsets[0][0].townID;
        let roleID = info.recordsets[0][0].RoleID;
        const boostTypeID = info.recordsets?.[1]?.[0]?.BoostTypeID;
        if (!boostTypeID) {
            return {
                success: false,
                message: `Invalid boost name: ${boostName}`
            }
        }
        if (roleID < 3) {
            return {
                success: false,
                message: "User does not have authority to purchase town boosts "
            }
        }

        const boostCost = BOOSTSINFO.townBoostsInfo[boostName].cost

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request2 = new sql.Request(transaction);
        request2.multiple = true;
        request2.input(`townID`, sql.Int, townID);
        request2.input('boostCost', sql.Int, boostCost);
        request2.input('boostTypeID', sql.Int, boostTypeID);

        let buyPerk = await request2.query(`
            -- Deduct cost and check balance
            UPDATE TownPurchases SET townFunds = townFunds - @boostCost WHERE townID = @townID
            SELECT townFunds FROM TownPurchases WHERE townID = @townID

            -- See if they already had the perk (not allowed to stack) and give them one
            SELECT COUNT(*) AS hadPerk 
            FROM TownBoosts TB
            LEFT JOIN BoostTypes BT ON TB.BoostTypeID = BT.BoostTypeID
            WHERE TB.townID = @townID AND TB.BoostTypeID = @boostTypeID AND TB.StartTime + BT.Duration > ${Date.now()}

            INSERT INTO TownBoosts (townID, BoostTypeID, StartTime) VALUES (@townID, @boostTypeID, ${Date.now()})
        `)
        if (!(buyPerk.recordsets[0]?.[0].townFunds >= 0)) {
            await transaction.rollback();
            return {
                success: false,
                message: "Town does not have sufficient funds"
            }
        }
        if (buyPerk.recordsets?.[1]?.[0]?.hadPerk > 0) {
            await transaction.rollback();
            return {
                success: false,
                message: "Town already has that boost active"
            }
        }    

        await transaction.commit();
        sendTownUsersData(townID, 'NEW_BOOST', {})
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
