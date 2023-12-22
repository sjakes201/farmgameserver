const sql = require('mssql');
const { poolPromise } = require('../../db');

// After getting all defined rewards, cycle through these JSON's with modulus
const CYCLE_REWARDS = [{ "TimeFertilizer": 100, "HarvestsFertilizer": 100, "YieldsFertilizer": 100 }, { "Boost": [2, 5] }, { "PremiumCurrency": 60 }, { "Gears": 100, "Bolts": 100, "MetalSheets": 100 }, { "Boost": [36, 39] }]

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID);
        let allReward = await request.query(`
            SELECT RewardID, Reward FROM LoginStreakRewards
            SELECT LastRewardTime, streakCount FROM PlayerLoginStreaksTracker WHERE UserID = @UserID
        `)

        return {
            success: true,
            cycleRewards: CYCLE_REWARDS,
            scheduledRewards: allReward.recordsets[0],
            playerStreak: allReward.recordsets[1]
        }

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "UNCAUGHT ERROR",
        }
    }
}





