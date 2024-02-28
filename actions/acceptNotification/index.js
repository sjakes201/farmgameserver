const sql = require('mssql');
const { poolPromise } = require('../../db');
const { giveUnlockID } = require('../../unlockFunctions');

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    const notificationID = actionData.notificationID;
    const processAction = actionData.processAction;

    const actionTypes = ["CLAIM"]

    if (!actionTypes.includes(processAction)) {
        return {
            success: false,
            message: `Invalid action ${processAction}`
        }
    }

    if (!Number.isInteger(notificationID) || notificationID < 0) {
        return {
            success: false,
            message: "Invalid notification ID"
        }
    }

    
    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin()
        let request = new sql.Request(transaction);

        request.input('UserID', sql.Int, UserID);
        request.input('notificationID', sql.Int, notificationID)

        if (processAction === "CLAIM") {
            let notificationsQuery = await request.query(`
                SELECT * FROM UserNotifications WHERE UserID = @UserID AND NotificationID = @notificationID
                DELETE FROM UserNotifications WHERE UserID = @UserID AND NotificationID = @notificationID
            `);
            if (notificationsQuery.recordset.length === 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: "No notification with that ID"
                }
            }
            let notifType = notificationsQuery.recordset[0].Type;

            if (notifType === "INDIV_TOWN_GOAL_REWARD") {
                let goldReward = notificationsQuery.recordset[0].GoldReward;
                request.input('goldReward', sql.Int, goldReward);

                let settleQuery = await request.query(`
                    UPDATE Profiles SET Balance = Balance + @goldReward WHERE UserID = @UserID
                `)
                await transaction.commit()
                return {
                    success: true,
                    goldReward: goldReward
                }
            }

            if (notifType === "LEADERBOARD_PREMIUM_REWARD") {
                let rewardJSON = notificationsQuery.recordset[0].Message;
                let rewardObj = JSON.parse(rewardJSON);
                let premiumCurrencyReward = rewardObj.reward;
                request.input('premiumCurrencyReward', sql.Int, premiumCurrencyReward);
                let res = await request.query(`
                    UPDATE Profiles SET premiumCurrency = premiumCurrency + @premiumCurrencyReward WHERE UserID = @UserID
                    SELECT premiumCurrency FROM Profiles WHERE UserID = @UserID
                `)
                let newAmount = res.recordset[0].premiumCurrency
                await transaction.commit();
                return {
                    success: true,
                    newPremiumCurrency: newAmount
                }
            }


            if (notifType === "EVENT_REWARD") {
                let rewardJSON = notificationsQuery.recordset[0].Message;
                let rewardObj = JSON.parse(rewardJSON);
                let rewardIdentified = false;
                let rewardData = rewardObj;
                // Iterate through all reward types that could be in the login reward, giving them if they exist
                // Premium currency reward
                if (rewardData.hasOwnProperty("PremiumCurrency")) {
                    let premiumCurrency = rewardData.PremiumCurrency;
                    if (Number.isInteger(premiumCurrency) && premiumCurrency > 0) {
                        let givePremium = await request.query(`
                        UPDATE Profiles SET premiumCurrency = premiumCurrency + ${premiumCurrency} WHERE UserID = @UserID
                    `)
                        rewardIdentified = true;
                    }
                }
                // Profile picture reward
                if (rewardData.hasOwnProperty("pfpUnlockID")) {
                    let pfpUnlockID = rewardData.pfpUnlockID;
                    giveUnlockID(UserID, pfpUnlockID)
                    rewardIdentified = true;
                }

                if (rewardIdentified) {
                    await transaction.commit();
                    return {
                        success: true,
                        reward: rewardData
                    }
                } else {
                    await transaction.rollback();
                    return {
                        success: false,
                        message: "Invalid event reward data"
                    }
                }
            }

            if (notifType === "LOGIN_STREAK_REWARD") {
                let rewardJSON = notificationsQuery.recordset[0].Message;
                let rewardObj = JSON.parse(rewardJSON);
                let rewardIdentified = false;
                let rewardData = rewardObj.reward;
                // Iterate through all reward types that could be in the login reward, giving them if they exist
                // Machine parts
                if (rewardData.hasOwnProperty("Gears") || rewardData.hasOwnProperty("Bolts") || rewardData.hasOwnProperty("MetalSheets")) {
                    let gearsCount = rewardData.Gears || 0, boltsCount = rewardData.Bolts || 0, metalSheetsCount = rewardData.MetalSheets || 0;
                    let giveParts = await request.query(`
                        UPDATE Inventory_PARTS SET MetalSheets = MetalSheets + ${metalSheetsCount}, Bolts = Bolts + ${boltsCount}, Gears = Gears + ${gearsCount} WHERE UserID = @UserID
                    `)
                    rewardIdentified = true;
                }
                // Fertilizer reward
                if (rewardData.hasOwnProperty("TimeFertilizer") || rewardData.hasOwnProperty("YieldsFertilizer") || rewardData.hasOwnProperty("HarvestsFertilizer")) {
                    let timeFertCount = rewardData.TimeFertilizer || 0, yieldFertCount = rewardData.YieldsFertilizer || 0, harvestFertCount = rewardData.HarvestsFertilizer || 0;
                    let giveFert = await request.query(`
                        UPDATE Inventory_EXTRA SET TimeFertilizer = TimeFertilizer + ${timeFertCount}, YieldsFertilizer = YieldsFertilizer + ${yieldFertCount}, HarvestsFertilizer = HarvestsFertilizer + ${harvestFertCount} WHERE UserID = @UserID
                    `)
                    rewardIdentified = true;
                }
                // Player boost reward
                if (rewardData.hasOwnProperty("Boost")) {
                    let boostIdArray = rewardData.Boost;
                    let boostQuery = ''
                    boostIdArray.forEach(boostID => {
                        boostQuery += `INSERT INTO PlayerBoosts (UserID, BoostTypeID) VALUES (@UserID, ${boostID});`
                    })
                    let giveBoosts = await request.query(boostQuery)
                    rewardIdentified = true;
                }
                // Premium currency reward
                if (rewardData.hasOwnProperty("PremiumCurrency")) {
                    let premiumCurrency = rewardData.PremiumCurrency;
                    let givePremium = await request.query(`
                        UPDATE Profiles SET premiumCurrency = premiumCurrency + ${premiumCurrency} WHERE UserID = @UserID
                    `)
                    rewardIdentified = true;
                }
                // Profile picture reward
                if (rewardData.hasOwnProperty("pfpUnlockID")) {
                    let pfpUnlockID = rewardData.pfpUnlockID;
                    giveUnlockID(UserID, pfpUnlockID)
                    rewardIdentified = true;
                }

                if (rewardIdentified) {
                    await transaction.commit();
                    return {
                        success: true,
                        reward: rewardData
                    }
                } else {
                    await transaction.rollback();
                    return {
                        success: false,
                        message: "Invalid login reward data"
                    }
                }
            }

        }
        await transaction.rollback();
        return {
            success: false,
            message: 'No valid notification of this type found'
        }

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "DATABASE ERROR",
        }
    }
}





