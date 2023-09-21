const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');

/*
    Should they not be able to purchase (even if frontend tries to stop) when not unlocked, or just collect? 
    Right now with xss attack they can purchase animals not unlocked, just not collect
*/

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

    // GET REQ INTO
    let animal_type = actionData.type;

    // GET USERID
    const UserID = ws.UserID;

    // CHECK ANIMALTYPE
    if (!(animal_type in CONSTANTS.AnimalTypes)) {
        return {
            message: "INVALID animal type in /buyAnimal"
        };
    }

    let [location, cost] = CONSTANTS.AnimalTypes[animal_type];
    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);

        // Get and increment animal ID, increment location and check (SQL +AnimalManagement)
        let capacity = location == 'coop' ? 'CoopCapacity' : 'BarnCapacity'
        let current = location == 'coop' ? 'CoopAnimals' : 'BarnAnimals'

        let managementQuery = await request.query(`
        UPDATE AnimalManagement
        SET ${current} = ${current} + 1, NextAnimalID = NextAnimalID + 1
        WHERE UserID = @UserID

        SELECT NextAnimalID, ${capacity}, ${current} FROM AnimalManagement WHERE UserID = @UserID
        `)

        if (managementQuery.recordset[0][current] > managementQuery.recordset[0][capacity]) {
            // Has capacity to fit it
            await transaction.rollback();
            return {
                message: `${capacity} REACHED`
            };
        }

        request.input('type', sql.NVarChar, animal_type)
        request.input('nextAnimalID', sql.Int, managementQuery.recordset[0].NextAnimalID - 1)
        request.input('now', sql.Decimal, Date.now())
        request.input('nextRandom', sql.Float, Math.round(Math.random() * 100) / 100)

        // insert into animals (SQL -AnimalManagement +Animals)
        let createAnimal = await request.query(`                
            INSERT INTO Animals (UserID, Animal_ID, Animal_type, Last_produce, Next_random) VALUES (@UserID, @nextAnimalID, @type, @now, @nextRandom)
            SELECT * FROM Animals WHERE UserID = @UserID AND Animal_ID = @nextAnimalID
        `)

        // decrement profile Balance (SQL -Animals +Profiles)
        request.input('cost', sql.Int, cost)
        let decrementBalance = await request.query(`
            UPDATE Profiles Set Balance = Balance - @cost WHERE UserID = @UserID
            SELECT Balance, XP FROM Profiles WHERE UserID = @UserID
        `)
        if (decrementBalance.recordset[0].Balance < 0) {
            //could not afford
            await transaction.rollback();
            return {
                message: "INSUFFICIENT BALANCE"
            };
        }
        let xp = decrementBalance.recordset[0].XP;
        let playerLevel = calcLevel(xp);

        for (let lvl in CONSTANTS.levelUnlocks) {
            if (parseInt(playerLevel) < lvl) {
                if (CONSTANTS.levelUnlocks[lvl].includes(animal_type)) {
                    console.log("NEED MORE XP");
                    await transaction.rollback();
                    return {
                        message: "NEED MORE XP"
                    };
                }
            }
        }

        // success
        await transaction.commit();
        return {
            ...createAnimal.recordset[0],
            message: 'SUCCESS'
        };

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    } 
}
