const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');
const { personalRewards } = require('../shared/townHelpers');


module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let slotNum = actionData.slotNum;

    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(slotNum)) {
        return {
            message: "Invalid goal slot, must be int [1,8]"
        };
    }


    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        // Get initial unclaimedData, then check later that it is the same
        let unclaimedQuery = await connection.query(`SELECT unclaimed_${slotNum} FROM TownContributions WHERE UserID = ${UserID}`)
        let unclaimedData = unclaimedQuery.recordset[0][`unclaimed_${slotNum}`]
        if (typeof unclaimedData !== 'string') {
            return {
                message: `No unclaimed reward at goal slot ${slotNum}`
            }
        }

        let [unclaimedGood, unclaimedQty] = unclaimedData.split(" ");
        unclaimedQty = parseInt(unclaimedQty);

        if (!(unclaimedGood in CONSTANTS.Init_Market_Prices) || !Number.isInteger(unclaimedQty)) {
            return {
                message: "Database unclaimed data fetch error"
            }
        }
        let rewards = personalRewards(unclaimedGood, unclaimedQty);
        const goldReward = rewards.gold;
        const xpReward = rewards.xp;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('goldReward', sql.Int, goldReward);
        request.input('xpReward', sql.Int, xpReward);

        let mainQuery = await request.query(`
        UPDATE Profiles SET Balance = Balance + @goldReward, XP = XP + @xpReward WHERE UserID = @UserID
        SELECT unclaimed_${slotNum} FROM TownContributions WHERE UserID = @UserID
        UPDATE TownContributions SET unclaimed_${slotNum} = NULL WHERE UserID = @UserID
        `)
        if (mainQuery.recordset[0][`unclaimed_${slotNum}`] !== unclaimedData) {
            await transaction.rollback();
            return {
                message: "Aborted goal claim due to double claim"
            }
        }

        await transaction.commit();
        return {
            message: "SUCCESS",
            personalRewards: rewards
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }

}





