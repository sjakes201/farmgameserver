const sql = require('mssql');
const { poolPromise } = require('../../db'); 

const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');

module.exports = async function (ws, actionData) {

    // GET REQ DATA
    let AnimalID = actionData?.AnimalID;
    // GET USER ID
    const UserID = ws.UserID;


    // COLLECT LOGIC

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        // Query upgrades info outside transaction 
        let upgrades = await connection.query(`SELECT * FROM Upgrades WHERE UserID = ${UserID}`);


        // Begin transaction
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('AnimalID', sql.Int, parseInt(AnimalID));

        // Get animal info (SQL +ANIMALS)
        let animalInfo = await request.query(`
        SELECT Animal_type, Last_produce, Next_random, Happiness 
        FROM Animals 
        WHERE UserID = @UserID AND Animal_ID = @AnimalID`)

        if ((animalInfo.recordset).length === 0) {
            await transaction.rollback();
            return {
                message: "ERROR Animal does not exist"
            };
        }

        // Find out if animal is unlocked based on upgraeds
        if (CONSTANTS.Permits.exoticAnimals.includes(animalInfo.recordset[0].Animal_type) && !upgrades.recordset[0].exoticPermit) {
            await transaction.rollback();
            return  {
                message: "NEED PERMIT"
            };
        }


        // Get time needed info based on upgrades
        let location = CONSTANTS.AnimalTypes[animalInfo.recordset[0].Animal_type][0]
        let collectUGLevel = 0;
        let quantityUGLevel = 0;
        switch (location) {
            case 'coop':
                collectUGLevel = upgrades.recordset[0].coopCollectTimeUpgrade;
                quantityUGLevel = upgrades.recordset[0].coopCollectQuantityUpgrade;
                break;
            case 'barn':
                collectUGLevel = upgrades.recordset[0].barnCollectTimeUpgrade;
                quantityUGLevel = upgrades.recordset[0].barnCollectQuantityUpgrade;
                break;
        }
        let collectTableName = "AnimalCollectTimes" + collectUGLevel;
        let quantityTableName = "AnimalProduceMap" + quantityUGLevel;

        // Check how much time has passed since last produce
        let last_produce = animalInfo.recordset[0].Last_produce;
        let timeNeeded = UPGRADES[collectTableName][animalInfo.recordset[0].Animal_type][0]

        const curTime = Date.now();
        let secsPassed = (curTime - last_produce) / 1000;
        // buffer for less 400's
        secsPassed += 0.50;

        if (secsPassed >= timeNeeded) {
            // Enough time has passed
            let [produce, qty] = UPGRADES[quantityTableName][animalInfo.recordset[0].Animal_type];
            request.input('curTime', sql.Decimal, curTime);
            request.input('xp', sql.Int, CONSTANTS.XP[produce])

            // Random probability of extra qty? At max happiness, 50% chance of extra produce
            let happiness = animalInfo.recordset[0].Happiness, nextRandom = animalInfo.recordset[0].Next_random;
            let probOfExtra = happiness > 1 ? 0.67 : happiness / 1.5;
            if (nextRandom < probOfExtra) {
                // extra produce bc of happiness
                qty += 1;
            }
            let newRandom = Math.round(Math.random() * 100) / 100;
            request.input('newRandom', sql.Float, newRandom)
            console.log(`happiness: ${happiness} nextRandom: ${nextRandom} probOfExtra: ${probOfExtra}`)

            // If enough time has passed, update Last_produce and give yourself XP for collect (SQL -ANIMALS +PROFILES)
            let timeUpdate = await request.query(`
            UPDATE Animals SET Last_produce = @curTime, Next_random = @newRandom WHERE UserID = @UserID AND Animal_ID = @AnimalID
            SELECT * FROM ANIMALS WHERE UserID = @UserID AND Animal_ID = @AnimalID
            UPDATE Profiles SET XP = XP + @xp WHERE UserID = @UserID
            `)

            request.input('qty', sql.Int, qty);
            // Increment inventory for what we collected (SQL -PROFILES +INVENTORY_PRODUCE)
            let inventoryCount = await request.query(`UPDATE Inventory_PRODUCE SET ${produce} = ${produce} + @qty WHERE UserID = @UserID`);
            if (inventoryCount?.rowsAffected[0] !== 1) {
                await transaction.rollback();
                throw "Failed to update inventory collect count"
            }

            // Update leaderboards (SQL -INVENTORY_PRODUCE +TempLeaderboardSum +LeaderboardSum)
            let leaderboardUpdate = await request.query(`
            UPDATE TempLeaderboardSum set ${produce} = ${produce} + @qty WHERE UserID = @UserID
            UPDATE LeaderboardSum set ${produce} = ${produce} + @qty WHERE UserID = @UserID
            `)
            if (leaderboardUpdate.rowsAffected[0] === 0) {
                await transaction.rollback();
                throw "Failed to update leaderboards collect count"
            }

            // Update ORDERS if applicable (SQL -TempLeaderboardSum -LeaderboardSum +ORDERS)
            let curOrders = await request.query(`SELECT goal_1, goal_2, goal_3, goal_4, progress_1, progress_2, progress_3, progress_4 FROM ORDERS WHERE UserID = @UserID`);
            let goal1 = curOrders.recordset[0].goal_1.split(" "), goal2 = curOrders.recordset[0].goal_2.split(" "), goal3 = curOrders.recordset[0].goal_3.split(" "), goal4 = curOrders.recordset[0].goal_4.split(" ");
            let progress1 = curOrders.recordset[0].progress_1, progress2 = curOrders.recordset[0].progress_2, progress3 = curOrders.recordset[0].progress_3, progress4 = curOrders.recordset[0].progress_4;
            let finishedOrder = false;

            // Check all goals to see if they are this crop, if they are not done yet (in case we have multiple of the same good, fill first then later ones), but only give to one
            if (goal1[0] === produce && progress1 < parseInt(goal1[1])) {
                if (progress1 + qty >= goal1[1]) { qty = goal1[1] - progress1; finishedOrder = true; }
                await request.query(`UPDATE ORDERS SET progress_1 = progress_1 + ${qty} WHERE UserID = @UserID`);
            } else if (goal2[0] === produce && progress2 < parseInt(goal2[1])) {
                if (progress2 + qty >= goal2[1]) { qty = goal2[1] - progress2; finishedOrder = true; }
                await request.query(`UPDATE ORDERS SET progress_2 = progress_2 + ${qty} WHERE UserID = @UserID`);
            } else if (goal3[0] === produce && progress3 < parseInt(goal3[1])) {
                if (progress3 + qty >= goal3[1]) { qty = goal3[1] - progress3; finishedOrder = true; }
                await request.query(`UPDATE ORDERS SET progress_3 = progress_3 + ${qty} WHERE UserID = @UserID`);
            } else if (goal4[0] === produce && progress4 < parseInt(goal4[1])) {
                if (progress4 + qty >= goal4[1]) { qty = goal4[1] - progress4; finishedOrder = true; }
                await request.query(`UPDATE ORDERS SET progress_4 = progress_4 + ${qty} WHERE UserID = @UserID`);
            }

            // If any are done irrespective of current collect/harvest, send flash as reminder
            if (progress1 >= parseInt(goal1[1]) || progress2 >= parseInt(goal2[1]) || progress3 >= parseInt(goal3[1]) || progress4 >= parseInt(goal4[1])) {
                finishedOrder = true;
            }




            await transaction.commit();
            return {
                ...timeUpdate.recordset[0],
                wasReady: true,
                finishedOrder: finishedOrder,
            };

        } else {
            // not enough time passed
            await transaction.rollback();
            return  {
                ...animalInfo.recordset[0],
                wasReady: false,
                finishedOrder: false,
            };

        }

    } catch (error) {
        console.log(error)
        if (transaction) await transaction.rollback()
        console.log("Connection error in animal collect call")
        return {
            message: "Connection error in /collect call"
        };
    } 


}





