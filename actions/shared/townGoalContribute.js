const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('./TOWNINFO');
const CONSTANTS = require ('./CONSTANTS')
const { calcTownLevel, calcPerkLevels } = require("./townHelpers.js")
const { townServerBroadcast } = require('../../broadcastFunctions')



module.exports = async function (UserID, contributedGood, contributedQuantity) {

    /*
        1. Get townID from Profiles
        2. get goals and progresses from TownGoals 
        3. If any goals match good add qty to progress 
        4a. If progress is now >= goals,
            - From profiles get all players who have townID
            - Call new goal function 
            - In TownContributions set unclaimed_n to goal_n IF where UserID in (previous step data) and unclaimed_n != null
            - reset TownContributions progress_n to 0 for all UserID in (town users)
        4b. else Add to TownContributions progress_n

        New goal function: townID
        if it's goal [5,8] then randomize one that isn't any other goal from first part and set to goal_n where townID
        If it's goal [1,4] then just reset goal progress

        Need to add townXP (not needed in transaction)
    */

    let connection;
    let transaction;
    let inTransaction = false;
    try {
        connection = await poolPromise;

        const requestConn = new sql.Request(connection);

        // Not in transaction: get townID of user who is contributing
        let townIDQuery = await requestConn.query(`SELECT townID FROM TownMembers WHERE UserID = ${UserID}`);
        let townID = townIDQuery.recordset?.[0]?.townID;
        if (!townID) {
            return;
        }

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        inTransaction = true;
        const requestTran = new sql.Request(transaction);

        requestConn.input('townID', sql.Int, townID)
        requestTran.input('townID', sql.Int, townID)
        requestTran.input('UserID', sql.Int, UserID)
        // Get towngoals for town of the User (SQL +TownGoals)
        let goalsInfoQuery = await requestTran.query(`SELECT * FROM TownGoals WHERE townID = @townID`);
        let goalsInfo = goalsInfoQuery.recordset[0];

        let goalText; let goalGood; let quantityNeeded; let quantityHave;
        // Check each goal to see if it's the contributed good
        let goalMatch = false;
        for (let goalNum = 1; goalNum <= 8; ++goalNum) {
            goalText = goalsInfo[`goal_${goalNum}`];
            [goalGood, quantityNeeded] = goalText.split(" ")
            quantityHave = goalsInfo[`progress_${goalNum}`]

            if (goalGood === contributedGood) {
                requestTran.input('qty', sql.Int, contributedQuantity)
                // Add the contributed quantity to the town goal
                await requestTran.query(`
                    UPDATE TownGoals SET progress_${goalNum} = progress_${goalNum} + @qty WHERE townID = @townID
                `)
                if (quantityHave + contributedQuantity >= quantityNeeded) {
                    // We need to generate a new goal and put this one in unclaimed, this one is done
                    // Generate new random town goal. If it's goal [1,4] it's set by leader and just refresh progress. Else randomize
                    if (goalNum <= 4) {
                        // Leader goal, just reset progress and goal to correct quantity (in case changed in config)
                        let goalString = `${goalGood} ${TOWNINFO.goalQuantities[goalGood]}`
                        await requestTran.query(`UPDATE TownGoals SET goal_${goalNum} = '${goalString}', progress_${goalNum} = 0 WHERE townID = @townID`)
                    } else {
                        // Randomize new unique goal
                        let allPreviousGoals = Object.keys(goalsInfo).filter((key) => key.includes("goal")).map((goalText) => goalsInfo[goalText].split(" ")[0])
                        let allPossibleGoals = Object.keys(TOWNINFO.goalQuantities).filter((goal) => !allPreviousGoals.includes(goal));
                        let newGoal = allPossibleGoals[Math.floor(Math.random() * allPossibleGoals.length)]
                        let newQty = TOWNINFO.goalQuantities[newGoal]
                        await requestTran.query(`UPDATE TownGoals SET goal_${goalNum} = '${newGoal} ${newQty}', progress_${goalNum} = 0 WHERE townID = @townID`)
                    }

                    // Outside of transaction, get all UserID's for people in this town
                    let membersQuery = await requestConn.query(`SELECT UserID FROM TownMembers WHERE townID = @townID`)
                    let members = membersQuery.recordset;
                    // Set unclaimed goal in town contributions for all users in town who don't have a previously unclaimed goal in that slot (SQL -TownGoals +TownContributions)
                    let userWhere = '('
                    members.forEach((e, index) => {
                        userWhere += index === members.length - 1 ? `${e.UserID})` : `${e.UserID}, `
                    })
                    // Set new goal and reset progress for that goal slot to 0 for everyone
                    await requestTran.query(`
                    UPDATE TownContributions SET unclaimed_${goalNum} = '${goalGood} ${quantityNeeded}' WHERE unclaimed_${goalNum} IS NULL AND UserID IN ${userWhere}
                    UPDATE TownContributions SET progress_${goalNum} = 0 WHERE UserID in ${userWhere}
                    `)
                    await transaction.commit();
                    townServerBroadcast(townID, `Town has completed goal ${CONSTANTS.InventoryDescriptions[goalGood][0]} ${parseInt(quantityNeeded).toLocaleString()}!`)

                    inTransaction = false;
                    goalMatch = true;
                    // Outside of transaction, add XP then check for new perk levels. XP is 1200 for animal produce goals, 1000 for crop goals
                    let earnedXP = goalGood.includes("_") ? 1200 : 1000;
                    requestConn.input('earnedXP', sql.Int, earnedXP)
                    let townXP = await requestConn.query(`
                        UPDATE Towns SET townXP = townXP + @earnedXP WHERE townID = @townID
                        SELECT * FROM Towns WHERE townID = @townID
                    `)
                    let townLevel = calcTownLevel(townXP.recordset[0].townXP);
                    let perkLevels = calcPerkLevels(townLevel);
                    let levelledUp = false;

                    if (perkLevels.growthPerk !== townXP.recordset[0].growthPerkLevel) {
                        await requestConn.query(`
                        UPDATE Towns SET growthPerkLevel = ${perkLevels.growthPerk} WHERE townID = @townID`)
                        levelledUp = true;
                    }
                    if (perkLevels.partsPerk !== townXP.recordset[0].partsPerkLevel) {
                        await requestConn.query(`
                        UPDATE Towns SET partsPerkLevel = ${perkLevels.partsPerk} WHERE townID = @townID`)
                        levelledUp = true;
                    }
                    if (perkLevels.orderRefreshPerk !== townXP.recordset[0].orderRefreshLevel) {
                        await requestConn.query(`
                        UPDATE Towns SET orderRefreshLevel = ${perkLevels.orderRefreshPerk} WHERE townID = @townID`)
                        levelledUp = true;
                    }
                    if (perkLevels.animalPerk !== townXP.recordset[0].animalPerkLevel) {
                        await requestConn.query(`
                        UPDATE Towns SET animalPerkLevel = ${perkLevels.animalPerk} WHERE townID = @townID`)
                        levelledUp = true;
                    }
                    if(levelledUp) {
                        townServerBroadcast(townID, `Town has levelled up!`)
                    }
                } else {
                    // They contributed to a goal, but it is not completed, so just increment TownContributions
                    await requestTran.query(`
                    UPDATE TownContributions SET progress_${goalNum} = progress_${goalNum} + @qty WHERE UserID = @UserID
                    `)
                    await transaction.commit();
                    goalMatch = true;
                    inTransaction = false

                }
                break; //End the loop that's searching through goals
            }
        }
        if (!goalMatch) {
            await transaction.rollback()
        }
        return {
            message: "SUCCESS"
        }
    } catch (error) {
        console.log(error);
        if (transaction && inTransaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





