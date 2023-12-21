const sql = require('mssql');
const { poolPromise } = require('../../db');

// After getting all defined rewards, cycle through these JSON's with modulus
const CYCLE_REWARDS = [{ "TimeFertilizer": 100, "HarvestsFertilizer": 100, "YieldsFertilizer": 100 }, { "Boost": [2, 5] }, { "PremiumCurrency": 60 }, { "Gears": 100, "Bolts": 100, "MetalSheets": 100 }, { "Boost": [36, 39] }]
const oneDayMS = 86400000;

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        let allReward = await connection.query(`
            SELECT * FROM LoginStreakRewards
        `)

        const createLoginRecord = async (request) => {
            let createRecord = await request.query(`
                INSERT INTO PlayerLoginStreaksTracker (UserID, LastRewardTime, streakCount) VALUES (@UserID, @nowMS, 1)
            `)
        }

        const incrementLoginRecord = async (request) => {
            let advanceRecord = await request.query(`
                UPDATE PlayerLoginStreaksTracker SET LastRewardTime = @nowMS, streakCount = streakCount + 1 WHERE UserID = @UserID
            `)
        }

        const giveReward = async (request, streakCount) => {
            // Give UserNotification for reward
            let numDefinedRewards = allReward.recordset.length;
            let parsedReward = null;
            if (streakCount > numDefinedRewards) {
                rewardObj = CYCLE_REWARDS[streakCount % CYCLE_REWARDS.length];
                parsedReward = rewardObj;
            } else {
                rewardJson = allReward.recordset.filter((reward) => reward.RewardID === streakCount)[0]
                parsedReward = JSON.parse(rewardJson.Reward);
            }
            // Store both the reward and the day you earned it
            let rewardString = JSON.stringify({
                streakCount: streakCount,
                reward: parsedReward
            })
            request.input(`rewardJSON`, sql.NVarChar, rewardString)
            let insertReward = await request.query(`
                INSERT INTO UserNotifications (UserID, Type, Message) VALUES (@UserID, 'LOGIN_STREAK_REWARD', @rewardJSON);
            `)
        }

        const resetReward = async (request) => {
            let resetRecord = await request.query(`
                UPDATE PlayerLoginStreaksTracker SET LastRewardTime = @nowMS, streakCount = 1 WHERE UserID = @UserID
            `)
        }

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        let request = new sql.Request(transaction);

        // Get their most recent info (SQL +PlayerLoginStreaksTracker)
        request.input('UserID', sql.Int, UserID);
        request.input('nowMS', sql.BigInt, Date.now());
        let previousReward = await request.query(`
            SELECT * FROM PlayerLoginStreaksTracker WHERE UserID = @UserID
        `)

        // If they did not previously have a tracker (new player) create them a row
        if (previousReward.recordset.length === 0) {
            await createLoginRecord(request);
            await giveReward(request, 1); // SQL -PLST +UserNotifications

        } else {
            let prevRewardTime = previousReward.recordset[0].LastRewardTime;
            let timePassed = Date.now() - prevRewardTime;
            if (timePassed < oneDayMS) {
                // Too early
                await transaction.rollback();
                return {
                    success: false,
                    message: "Too soon, 1 day has not passed"
                }
            } else if (timePassed > oneDayMS * 2) {
                // Streak has expired
                await resetReward(request);
                await giveReward(request, 1); // SQL -PLST +UserNotifications
            } else {
                // They have a valid streak going
                const streakCount = previousReward.recordset[0].streakCount + 1;
                await incrementLoginRecord(request);
                await giveReward(request, streakCount); // SQL -PLST +UserNotifications
            }
        }

        await transaction.commit();
        return {
            success: true,
        }

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback();
        return {
            success: false,
            message: "UNCAUGHT ERROR",
        }
    }
}





