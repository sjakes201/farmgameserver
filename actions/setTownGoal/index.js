const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO')


module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let newGoal = actionData.newGoal;
    let goalSlot = actionData.goalSlot;

    if (!Object.keys(TOWNINFO.goalQuantities).includes(newGoal) || ![1,2,3,4].includes(goalSlot)) {
        return {
            message: `Invalid setTownGoal Inputs ${typeof newGoal} ${newGoal} and ${typeof goalSlot} ${goalSlot}`
        };
    }

    /*
        Set town goal to new (if unique)
        Reset progress for towngoals
        reset individual contributions for all users

    */


    let connection;
    let transaction;
    try {
        let goalQuantity = TOWNINFO.goalQuantities[newGoal]
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);

        // Get your townID (SQL +Profiles)
        let townIDQuery = await request.query(`
        SELECT townID FROM Profiles WHERE UserID = @UserID
        `)
        let yourTownID = townIDQuery.recordset[0].townID
        if (yourTownID === -1) {
            await transaction.rollback();
            return {
                message: "You are not in a town"
            };
        }

        // Set TownGoal and check you are leader (SQL -Profiles +-Towns +TownGoals)
        request.input('townID', sql.Int, yourTownID)
        let changeQuery = await request.query(`
            SELECT leader FROM Towns WHERE townID = @townID
            UPDATE TownGoals SET goal_${goalSlot} = '${newGoal} ${goalQuantity}', progress_${goalSlot} = 0 WHERE townID = @townID
        `)

        let leaderUserID = changeQuery.recordset[0].leader;
        if (leaderUserID !== UserID) {
            await transaction.rollback();
            return {
                message: "Only the leader of this town can change the status"
            };
        }

        // Reset slot progress in TownContributions for all town members (SQL -TownGoals +TownContributions)
        await request.query(`
        UPDATE TownContributions SET progress_${goalSlot} = 0 WHERE townID = @townID
        `)

        await transaction.commit();
        return {
            message: "SUCCESS"
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





