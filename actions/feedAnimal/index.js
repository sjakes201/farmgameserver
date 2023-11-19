const sql = require('mssql');
const { poolPromise } = require('../../db');
const ANIMALINFO = require('../shared/ANIMALINFO');
const TOWNSHOP = require('../shared/TOWNSHOP')


module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;


    const animalID = actionData.animalID;
    const foodType = actionData.foodType;

    if (!(foodType in ANIMALINFO.FoodHappinessYields)) {
        console.log("invalid food");
        return {
            message: `${foodType} is not a valid food`
        };
    }
    if (!Number.isInteger(animalID)) {
        console.log("Invalid animal ID");
        return {
            message: "Invalid animal ID"
        };
    }

    let foodHappiness = ANIMALINFO.FoodHappinessYields[foodType];
    let multiplier = 1;


    let connection;
    let transaction;
    try {

        connection = await poolPromise;
        const typeRequest = new sql.Request(connection);
        typeRequest.input('UserID', sql.Int, UserID);
        typeRequest.input('animalID', sql.Int, parseInt(animalID));
        // Get town perks 
        const townPerksQuery = await typeRequest.query(`
            SELECT 
                TM.townID, 
                TP.happinessMultiplierLevel
            FROM 
                TownMembers TM
            INNER JOIN 
                TownPurchases TP ON TP.townID = TM.townID
            WHERE 
                TM.UserID = @UserID;
            `)
        const happinessPerkLevel = townPerksQuery?.recordset?.[0]?.happinessMultiplierLevel
        let townMultiplier = 1;
        if (happinessPerkLevel > 0) {
            townMultiplier = 1 + TOWNSHOP.perkBoosts.happinessMultiplierLevel[happinessPerkLevel - 1]
        }

        // get animal type from database
        let typeQuery = await typeRequest.query(`SELECT Animal_type FROM Animals WHERE UserID = @UserID AND Animal_ID = @animalID`)
        const animalType = typeQuery.recordset[0].Animal_type;
        // food preference multiplier
        if (ANIMALINFO.foodPreferences[animalType].like.includes(foodType)) {
            multiplier = 2;
        } else if (ANIMALINFO.foodPreferences[animalType].dislike.includes(foodType)) {
            multiplier = -1;
        }
        // get Last_fed from Animals
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('animalID', sql.Int, parseInt(animalID));
        request.input('happinessChange', sql.Decimal(4, 3), (foodHappiness * multiplier * (multiplier === -1 ? 1 : townMultiplier)));
        let animalQuery = await request.query(`SELECT Last_Fed, Happiness FROM Animals WHERE UserID = @UserID AND Animal_ID = @animalID`);
        // if feed cooldown has not passed, return forbidden
        let lastFed = animalQuery.recordset[0].Last_Fed;
        let currentHappiness = animalQuery.recordset[0].Happiness;
        if (lastFed > Date.now() - ANIMALINFO.VALUES.FEED_COOLDOWN) {
            console.log("feed cooldown not done");
            await transaction.rollback();
            return {
                message: "Must wait for feed cooldown"
            };
        }
        // increment animals happiness by amount in column IF not over max, set Last_fed to Date.now()
        // the animal can eat the food regardless, just wont increase happiness
        if ((currentHappiness >= ANIMALINFO.VALUES.MAX_HAPPINESS || currentHappiness < -0.25) && foodHappiness * multiplier > 0) {
            // it's already at max
            let feedQuery = await request.query(`
            UPDATE Animals SET Last_Fed = ${Date.now()} WHERE UserID = @UserID AND Animal_ID = @animalID
            UPDATE Inventory_PRODUCE SET ${foodType} = ${foodType} - 1 WHERE UserID = @UserID
            SELECT ${foodType} FROM Inventory_PRODUCE WHERE UserID = @UserID
            `);
            if (feedQuery.recordset[0][foodType] < 0) {
                await transaction.rollback();
                return {
                    message: `INSUFFICIENT food count of type ${foodType}`
                };
            }
        } else {
            // it will receive a happiness change
            let feedQuery = await request.query(`
            UPDATE Animals SET Happiness = Happiness + @happinessChange, Last_Fed = ${Date.now()} WHERE UserID = @UserID AND Animal_ID = @animalID
            UPDATE Inventory_PRODUCE SET ${foodType} = ${foodType} - 1 WHERE UserID = @UserID
            SELECT ${foodType} FROM Inventory_PRODUCE WHERE UserID = @UserID
            `);
            if (feedQuery.recordset[0][foodType] < 0) {
                await transaction.rollback();
                return {
                    message: `INSUFFICIENT food count of type ${foodType}`
                };
            }
        }
        await transaction.commit()
        return {
            message: "SUCCESSFUL feed"
        }
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: 'Error in feedAnimal'
        }
    }
}





