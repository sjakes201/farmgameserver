const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('./TOWNINFO');
const CONSTANTS = require('./CONSTANTS')
const { calcIndivRewards, newIndividualGoal } = require("./townHelpers.js")
const { townServerBroadcast } = require('../../broadcastFunctions')

/**
 * 
 * @param {Object} connection - Live msqql database connection
 * @param {number} UserID - Int UserID of xp receiving user
 * @param {number} countContributed - Int amount of crop contributed
 * @param {number} totalNeeded - Int total amount of crop needed
 * @param {number} totalTownXP - Int townXP the town gets for this goal
 */

const giveUserTownXP = async (connection, UserID, countContributed, totalNeeded, totalTownXP) => {
    try {
        const userPercent = countContributed / totalNeeded;
        const userTownXP = totalTownXP * userPercent;
        if (typeof userTownXP !== 'number' || isNaN(userTownXP)) {
            throw new Error('userTownXP must be a valid number');
        }
        await connection.query(`
            UPDATE Profiles SET totalContributedTownXP = totalContributedTownXP + ${userTownXP} WHERE UserID = ${UserID}
            UPDATE TownMembers SET contributedTownXP = contributedTownXP + ${userTownXP} WHERE UserID = ${UserID}
        `)
    } catch (error) {
        console.log(error)
    }
}

module.exports = async function (UserID, contributedGood, contributedQuantity) {

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
        requestTran.multiple = true;

        requestConn.input('townID', sql.Int, townID)

        requestTran.input('townID', sql.Int, townID)
        requestTran.input('UserID', sql.Int, UserID)
        requestTran.input('qty', sql.Int, contributedQuantity)
        // Check individual town goals (SQL +IndividualTownGoals)
        let indivGoals = await requestTran.query(`
            SELECT Good, Quantity, progress, townFunds, goalID FROM IndividualTownGoals WHERE UserID = @UserID
            SELECT Good FROM IndividualTownGoals WHERE townID = @townID AND (UserID != @UserID OR UserID IS NULL)
        `)
        if (indivGoals.recordsets?.[0]?.[0]?.Good === contributedGood) {
            // They have an individual goal for this good, this takes priority over town goal
            const townFundsReward = indivGoals.recordsets[0][0].townFunds;
            const qtyNeeded = indivGoals.recordsets[0][0].Quantity;
            const qtyHave = indivGoals.recordsets[0][0].progress;
            const goalID = indivGoals.recordsets[0][0].goalID
            if (qtyHave + contributedQuantity >= qtyNeeded) {
                // Finished individual goal, give town xp credit to both, generate new one, put in user's notifications (SQL -IndividualTownGoals +UserNotifications)
                // generate new goal
                const allOtherGoals = indivGoals.recordsets[1]
                const newGoal = await newIndividualGoal(allOtherGoals, null, connection)

                // logging old goal in notifications to claim
                const rewards = calcIndivRewards(contributedGood, qtyNeeded);
                requestTran.input(`goldReward`, sql.Int, rewards.gold)
                requestTran.input('newGood', sql.NVarChar(64), newGoal.Good)
                requestTran.input('newQty', sql.Int, newGoal.Quantity)
                requestTran.input('newTownFunds', sql.Int, newGoal.townFunds)
                requestTran.input('goalID', sql.Int, goalID)
                const rewardInfo = {
                    good: contributedGood,
                    qty: qtyNeeded,
                    goalID: goalID
                }
                requestTran.input('notificationString', sql.NVarChar(512), JSON.stringify(rewardInfo))
                await requestTran.query(`
                    UPDATE IndividualTownGoals SET UserID = NULL, Good = @newGood, Quantity = @newQty, townFunds = @newTownFunds, progress = 0, Expiration = NULL WHERE townID = @townID AND goalID = @goalID
                    INSERT INTO UserNotifications (UserID, Type, Message, GoldReward) VALUES (@UserID, 'INDIV_TOWN_GOAL_REWARD', @notificationString, @goldReward)
                `)
                await transaction.commit();

                // Give town XP
                let earnedXP = townFundsReward;
                requestConn.input('earnedXP', sql.Int, earnedXP)
                await requestConn.query(`
                    UPDATE Towns SET townXP = townXP + @earnedXP WHERE townID = @townID
                    UPDATE TownPurchases SET townFunds = townFunds + @earnedXP WHERE townID = @townID
                `)
                await giveUserTownXP(connection, UserID, 1, 1, earnedXP)
                return {
                    success: true,
                }
            } else {
                // Progressed in individual goal
                await requestTran.query(`UPDATE IndividualTownGoals SET progress = progress + @qty WHERE UserID = @UserID`)
                await transaction.commit();
                return {
                    success: true
                }
            }
        }

        // Get towngoals for town of the User (SQL -IndividualTownGoals +TownGoals)
        let goalsInfoQuery = await requestTran.query(`
        SELECT * FROM TownGoals WHERE townID = @townID
        `);
        let goalsInfo = goalsInfoQuery.recordset[0];

        let goalText; let goalGood; let quantityNeeded; let quantityHave;
        // Check each goal to see if it's the contributed good
        let goalMatch = false;
        for (let goalNum = 1; goalNum <= 8; ++goalNum) {
            goalText = goalsInfo[`goal_${goalNum}`];
            [goalGood, quantityNeeded] = goalText.split(" ")
            quantityHave = goalsInfo[`progress_${goalNum}`]

            if (goalGood === contributedGood) {
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
                    let contributionsResult = await requestTran.query(`
                    UPDATE TownContributions SET unclaimed_${goalNum} = '${goalGood} ${quantityNeeded}' WHERE unclaimed_${goalNum} IS NULL AND UserID IN ${userWhere}
                    SELECT progress_${goalNum}, UserID FROM TownContributions WHERE UserID IN ${userWhere}
                    UPDATE TownContributions SET progress_${goalNum} = 0 WHERE UserID IN ${userWhere}
                    `)
                    await transaction.commit();
                    // townServerBroadcast(townID, `Town has completed goal ${CONSTANTS.InventoryDescriptions[goalGood][0]} ${parseInt(quantityNeeded).toLocaleString()}!`, 'GOAL_COMPLETE')

                    inTransaction = false;
                    goalMatch = true;
                    // Outside of transaction, add XP then check for new perk levels. XP is 1200 for animal produce goals, 1000 for crop goals
                    let earnedXP = goalGood.includes("_") ? 1200 : 1000;
                    requestConn.input('earnedXP', sql.Int, earnedXP)
                    // SQL -Towns +TownPurchases
                    let townXP = await requestConn.query(`
                        UPDATE Towns SET townXP = townXP + @earnedXP WHERE townID = @townID
                        SELECT * FROM Towns WHERE townID = @townID
                        UPDATE TownPurchases SET townFunds = townFunds + @earnedXP WHERE townID = @townID
                    `)

                    // Give each user credit for their fraction of the contribution
                    let xpPromises = contributionsResult.recordset.map((user) => {
                        if (user.UserID === UserID) {
                            if (user[`progress_${goalNum}`] + contributedQuantity > 0) {
                                return giveUserTownXP(connection, user.UserID, user[`progress_${goalNum}`] + contributedQuantity, quantityNeeded, earnedXP);
                            }
                        } else {
                            if (user[`progress_${goalNum}`] > 0) {
                                return giveUserTownXP(connection, user.UserID, user[`progress_${goalNum}`], quantityNeeded, earnedXP);
                            }
                        }
                        return Promise.resolve(); // If no XP to give, resolve immediately
                    });
                    // Ensure main code does not terminate before done
                    await Promise.all(xpPromises);


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





