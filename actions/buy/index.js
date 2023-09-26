const CONSTANTS = require('../shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db');

const SEED_LIMIT = 100;



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
    // GET USERID
    const UserID = ws.UserID;


    // GET INPUTS   
    let Item = actionData.item, count = parseInt(actionData.count);

    if (typeof Item !== "string" || count < 0 || !Number.isInteger(count)) {
        console.log("INVALID INPUTS");
        return {
            message: "ERROR: Invalid /buy inputs"
        };
    }
    // Item is name in SQL table, ex: "melon_seeds"
    if (!(Item in CONSTANTS.ProduceIDs)) {
        // Invalid request
        console.log(`INVALID INPUTS UserID: ${UserID} Item: ${Item}`);

        return {
            message: "ERROR: Invalid request"
        };
    }
    let price = (CONSTANTS.Fixed_Prices[Item] * count);

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        let xpQuery;
        if (count > 25) {
            // Abnormal purchase quantity, potentially scripting
            xpQuery = await connection.query(`
            UPDATE Profiles SET irregularBuy = irregularBuy + 1 WHERE UserID = ${UserID}
            SELECT XP from Profiles WHERE UserID = ${UserID}
            `)
        } else {
            xpQuery = await connection.query(`SELECT XP from Profiles WHERE UserID = ${UserID}`)
        }
        let upgradesQuery = await connection.query(`SELECT deluxePermit, plantNumHarvestsUpgrade FROM Upgrades WHERE UserID = ${UserID}`);

        let xp = xpQuery.recordset[0].XP;
        let level = calcLevel(xp);
        for (let lvl in CONSTANTS.levelUnlocks) {
            if (parseInt(level) < lvl) {
                if (CONSTANTS.levelUnlocks[lvl].includes(Item)) {
                    console.log("NEED MORE XP");
                    return {
                        message: "NEED MORE XP"
                    };
                }
            }
        }

        if (CONSTANTS.Permits.deluxeCrops.includes(Item)) {
            let permitData = upgradesQuery.recordset[0].deluxePermit;
            if (!permitData) {
                console.log("You need to buy a deluxe crops permit.");
                return {
                    message: "NEED PERMIT"
                };
            }
        }


        transaction = new sql.Transaction(connection);
        await transaction.begin();

        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('count', sql.Int, parseInt(count));
        request.input('price', sql.Int, price);

        // Decrement and check balance (SQL +Profiles)
        const info = await request.query(`
            UPDATE Profiles SET Balance = Balance - @price WHERE UserID = @UserID
            SELECT Balance FROM Profiles WHERE UserID = @UserID
        `)
        let userBal = info.recordsets[0][0].Balance;
        if (userBal < 0) {
            await transaction.rollback();
            console.log("INSUFFICIENT BALANCE");

            return {
                message: "INSUFFICIENT BALANCE"

            };
        }

        // Check if over seed limit (SQL -Profiles +Inventory_SEEDS)
        const seedCount = await request.query(`
            UPDATE Inventory_SEEDS SET ${Item} = ${Item} + @count WHERE UserID = @UserID
            SELECT ${Item} FROM Inventory_SEEDS WHERE UserID = @UserID
        `)
        if (seedCount.recordset[0][Item] > SEED_LIMIT) {
            console.log("SEED CAPACITY!!")
            await transaction.rollback();
            return {
                message: "SEED CAPACITY"
            };
        }

        await transaction.commit();
        return {
            message: "SUCCESS"
        };
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback();
    }
}





