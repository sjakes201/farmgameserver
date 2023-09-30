const sql = require('mssql');
const { poolPromise } = require('../../db');

const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const ORDERS = require('../shared/ORDERS');


const calcLevel = (XP) => {
    const lvlThresholds = CONSTANTS.xpToLevel;
    let level = 0;
    let remainingXP = XP;
    for (let i = 0; i < lvlThresholds.length; ++i) {
        if (XP >= lvlThresholds[i]) {
            level = i;
            remainingXP = XP - lvlThresholds[i]
        }
    }
    // If level is >= 15, and remainingXP is > 0, we calculate remaining levels (which are formulaic, each level is)
    while (remainingXP >= 600) {
        ++level;
        remainingXP -= 600;
    }
    // find next threshold
    return level
}



module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    // GET INPUTS
    let orderNum = actionData.orderNum;
    if (![1, 2, 3, 4].includes(orderNum)) {
        return {
            message: "INVALID ORDER ID"
        };
    }


    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        // Get info to calc rewards, check later that these are what the rewards were in case changed
        let unlockedQuery = await connection.query(`SELECT goal_1, goal_2, goal_3, goal_4 FROM ORDERS WHERE UserID = ${UserID}`);
        let upgradesQuery = await connection.query(`SELECT exoticPermit, deluxePermit FROM Upgrades WHERE UserID = ${UserID}`);
        let exoticPermit = upgradesQuery.recordset[0].exoticPermit, deluxePermit = upgradesQuery.recordset[0].deluxePermit;

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        let request = new sql.Request(transaction);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID)





        const goal = unlockedQuery.recordset[0][`goal_${orderNum}`];
        const good = goal.split(" ")[0]
        const numNeeded = goal.split(" ")[1]
        request.input('numNeeded', sql.Int, numNeeded)


        // calculate reward
        const goldReward = Math.floor(CONSTANTS.Init_Market_Prices[good] * (2 / 3) * numNeeded);
        const xpReward = Math.floor(CONSTANTS.XP[good] * (2 / 3) * numNeeded);
        request.input('goldReward', sql.Int, goldReward)
        request.input('xpReward', sql.Int, xpReward)

        // Give reward, get count (SQL +-Profiles +Inventory_PRODUCE)
        const haveQuery = await request.query(`
        UPDATE Profiles SET Balance = Balance + @goldReward, XP = XP + @xpReward WHERE UserID = @UserID
        SELECT XP FROM Profiles WHERE UserID = @UserID
        UPDATE Inventory_PRODUCE SET ${good} = ${good} - @numNeeded WHERE UserID = @UserID
        SELECT ${good} FROM Inventory_PRODUCE WHERE UserID = @UserID
        `)
        const XP = haveQuery.recordsets[0][0].XP;
        const remaining = haveQuery.recordsets[1][0][good];
        if (remaining < 0) {
            await transaction.rollback();
            return {
                message: "INSUFFICIENT PRODUCE"
            }
        }

        // get list of all unlocked goods
        let unlockedGoods = [];

        let level = calcLevel(XP);
        const levelThresholds = Object.keys(CONSTANTS.levelUnlocks);
        // xpUnlocks has what you unlock at every XP threshold
        const levelUnlocks = CONSTANTS.levelUnlocks;
        for (let i = 0; i < levelThresholds.length; ++i) {
            // for all thresholds
            if (level >= levelThresholds[i]) {
                // if you have unlocked this threshold
                for (let j = 0; j < levelUnlocks[levelThresholds[i]].length; ++j) {
                    // for all goods in this threshold
                    let item = levelUnlocks[levelThresholds[i]][j];
                    if (CONSTANTS.Permits.deluxeCrops.includes(item) && !deluxePermit) {
                        // is deluxe and you don't have the permit
                        continue;
                    }
                    if (CONSTANTS.Permits.exoticAnimals.includes(item) && !exoticPermit) {
                        // is exotic and you don't have the permit
                        continue;
                    }
                    // you have it unlocked, find out what good it is (right now we are looking at seeds and animals)
                    if (item.includes("_")) {
                        // is a seed as "TYPE_SEEDS"
                        unlockedGoods.push(CONSTANTS.SeedCropMap[item][0])
                    } else {
                        // is an animal as one word "ANIMAL"
                        unlockedGoods.push(UPGRADES.AnimalProduceMap0[item][0])
                    }
                }
            }
        }


        // Create new random good, ensure there are always at least 2 crop goals and no dupliactes
        let allOldGoals = [];
        allOldGoals.push(unlockedQuery.recordset[0].goal_1.split(" ")[0])
        allOldGoals.push(unlockedQuery.recordset[0].goal_2.split(" ")[0])
        allOldGoals.push(unlockedQuery.recordset[0].goal_3.split(" ")[0])
        allOldGoals.push(unlockedQuery.recordset[0].goal_4.split(" ")[0])
        let allNewGoals = allOldGoals.filter((e) => e !== good);
        let numCropOrders = allNewGoals.filter((e) => !e.includes("_")).length;
        if (numCropOrders < 2) {
            unlockedGoods = unlockedGoods.filter((e) => !e.includes("_"))
        }
        let randomGood = '';
        // for low level players who do not have a lot unlocked, we need to limit attempts because they may need to permit duplicates or < 2
        let attempts = 0;
        do {
            attempts++;
            let index = Math.floor(Math.random() * unlockedGoods.length);
            randomGood = unlockedGoods[index];
            console.log(randomGood)
            // We want at least 2 crop orders. 
        } while (allNewGoals.includes(randomGood) && attempts < 10)

        let newNumNeeded = ORDERS.OrderQuantities[randomGood][Math.floor(Math.random() * 3)]

        // Check that the order is still what it was pre-transaction (SQL -Inventory_PRODUCE +ORDERS)
        let confirmOrder = await request.query(`SELECT goal_${orderNum} FROM ORDERS WHERE UserID = @UserID`);
        if (confirmOrder.recordset[0][`goal_${orderNum}`] !== unlockedQuery.recordset[0][`goal_${orderNum}`]) {
            // Out of sync
            await transaction.rollback()
            return {
                message: "INTERNAL ORDER SYNC ERROR"
            };
        }

        //random chance of more fertilizer
        let newReward = '';
        if (Math.random() < 0.66) {
            let type = 'TimeFertilizer';
            let typeChance = Math.random();
            if (typeChance < 0.33) {
                type = 'TimeFertilizer'
            } else if (typeChance < 0.66) {
                type = 'HarvestsFertilizer'
            } else {
                type = 'YieldsFertilizer'
            }
            let num = 1;
            let numChance = Math.random()
            if (numChance < 0.60) {
                num = 1;
            } else if (numChance < 0.95) {
                num = 2;
            } else {
                num = 3;
            }
            newReward = `${type}${num}`
        }


        // Create new order
        let newOrderQuery = await request.query(`
            SELECT reward_${orderNum} FROM Orders WHERE UserID = @UserID
            UPDATE ORDERS SET goal_${orderNum} = '${randomGood} ${newNumNeeded}', reward_${orderNum} = '${newReward}' WHERE UserID = @UserID
            `);
        let reward = newOrderQuery.recordset[0][`reward_${orderNum}`];
        if (reward !== '') {
            let rewardInfo = ['', -1]
            if (reward !== '') {
                rewardInfo[1] = reward.substring(reward.length - 1, reward.length)
                rewardInfo[0] = reward.substring(0, reward.length - 1)
            }
            // SQL -ORDERS +Inventory_EXTRA
            await request.query(`
                UPDATE Inventory_EXTRA SET
                ${rewardInfo[0]} = ${rewardInfo[0]} + ${rewardInfo[1]}
                WHERE UserID = @UserID
                `)
            // string 'TimeFertilizerN' or 'HarvestsFertilizerN' or 'YieldsFertilizerN' with n being the amount
        }
        if (newOrderQuery.rowsAffected[0] === 0) {
            await transaction.rollback();
            return {
                message: "NEW ORDER CREATION FAILED"
            };
        }
        await transaction.commit();
        return {
            message: "SUCCESS",
            newGood: randomGood,
            newNumNeeded: newNumNeeded,
            newReward: newReward
        }
        // return object has both rewards and new goal

    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: "Uncaught error"
        };
    }
}





