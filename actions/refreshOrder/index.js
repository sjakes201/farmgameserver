const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const ORDERS = require('../shared/ORDERS');
const TOWNINFO = require('../shared/TOWNINFO');
const TOWNSHOP = require('../shared/TOWNSHOP');

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

    // VERIFY USER ID
    const UserID = ws.UserID;


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
        let preRequest = new sql.Request(connection)
        preRequest.multiple = true;
        preRequest.input(`UserID`, sql.Int, UserID);
        // get unlocks info
        let currentOrders = await preRequest.query(`SELECT * FROM ORDERS WHERE UserID = @UserID`)

        let userQuery = await preRequest.query(`
            SELECT 
                XP
            FROM Profiles 
            WHERE UserID = @UserID
            SELECT * 
            FROM 
                Upgrades 
            WHERE 
                UserID = @UserID;

        `);
        let townPerks = userQuery.recordsets[0][0]

        let XP = userQuery.recordsets[0][0].XP, exoticPermit = userQuery.recordsets[1][0].exoticPermit, deluxePermit = userQuery.recordsets[1][0].deluxePermits;
        let unlockedGoods = [];

        //
        // XP Thresholds are the keys: 0,200,500,1000,2000...
        const levels = Object.keys(CONSTANTS.levelUnlocks);
        // xpUnlocks has what you unlock at every XP threshold
        const levelUnlocks = CONSTANTS.levelUnlocks;
        let playerLevel = calcLevel(XP);

        for (let i = 0; i < levels.length; ++i) {
            // for all thresholds
            if (playerLevel >= levels[i]) {
                // if you have unlocked this threshold
                for (let j = 0; j < levelUnlocks[levels[i]].length; ++j) {
                    
                    // for all goods in this threshold
                    let item = levelUnlocks[levels[i]][j];
                    if(item === 'multiplant' || item === 'multiharvest' || item === 'special1_seeds') {
                        // not valid order goods
                        continue;
                    }
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
                        console.log(item)
                        unlockedGoods.push(UPGRADES.AnimalProduceMap0[item][0])
                    }
                }
            }
        }

        // Unlocked goods is now an array of all GOODS unlocked, choose a random one (maybe we should guess and check until we get one unlocked?)

        // Create new random good, ensure there are always at least 2 crop goals and no dupliactes
        let allOldGoals = [];
        let good = currentOrders.recordset[0][`goal_${orderNum}`].split(" ")[0]
        allOldGoals.push(currentOrders.recordset[0].goal_1.split(" ")[0])
        allOldGoals.push(currentOrders.recordset[0].goal_2.split(" ")[0])
        allOldGoals.push(currentOrders.recordset[0].goal_3.split(" ")[0])
        allOldGoals.push(currentOrders.recordset[0].goal_4.split(" ")[0])
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
            // We want at least 2 crop orders. 
        } while (allNewGoals.includes(randomGood) && attempts < 10)





        let newNumNeeded = ORDERS.OrderQuantities[randomGood][Math.floor(Math.random() * 3)]

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        let request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID)
        let lastRefresh = await request.query(`SELECT LastOrderRefresh from Profiles WHERE UserID = @UserID
                                               UPDATE Profiles SET LastOrderRefresh = ${Date.now()} WHERE UserID = @UserID`);
        let lastTime = lastRefresh.recordset[0].LastOrderRefresh;
        let timePassedMS = Date.now() - lastTime;

        if (townPerks?.orderRefreshLevel > 0) {
            let boostPercent = TOWNSHOP.perkBoosts.partsChanceLevel[townPerks.orderRefreshLevel - 1];
            let boostChange = 1 + boostPercent;
            timePassedMS *= boostChange;
        }
        if (timePassedMS >= CONSTANTS.VALUES.ORDER_REFRESH_COOLDOWN) {
            //enough time has passed
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
                let num = 2;
                let numChance = Math.random()
                if (numChance < 0.60) {
                    num = 2;
                } else if (numChance < 0.95) {
                    num = 3;
                } else {
                    num = 4;
                }
                newReward = `${type}${num}`
            }

            let newOrderQuery = await request.query(`UPDATE ORDERS SET goal_${orderNum} = '${randomGood} ${newNumNeeded}', reward_${orderNum} = '${newReward}' WHERE UserID = @UserID`);
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
            };
        } else {
            //cooldown not over
            await transaction.rollback()
            return {
                message: '15 minute cooldown between refreshes'
            };
        }
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: "Uncaught error"
        }
    }
}





