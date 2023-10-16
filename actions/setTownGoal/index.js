const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO')


module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let newGoal = actionData.newGoal;
    let goalSlot = actionData.goalSlot;

    if (!Object.keys(TOWNINFO.goalQuantities).includes(newGoal) || ![1, 2, 3, 4].includes(goalSlot)) {
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

        const request = new sql.Request(connection);
        request.input(`UserID`, sql.Int, UserID);

        // Get your townID 
        let townIDQuery = await request.query(`
        SELECT townID, RoleID FROM TownMembers WHERE UserID = @UserID
        `)
        let yourTownID = townIDQuery.recordset?.[0]?.townID
        let yourRoleID = townIDQuery.recordset?.[0]?.RoleID
        if (!yourTownID || !yourRoleID) {
            return {
                message: "You are not in a town"
            };
        }
        if (yourRoleID < 3) {
            return {
                message: "You do not have auth in town to set goals"
            }
        }

        // Set TownGoal (SQL +-TownGoals +TownContributions)
        request.input('townID', sql.Int, yourTownID)
        await request.query(`
            UPDATE TownGoals SET goal_${goalSlot} = '${newGoal} ${goalQuantity}', progress_${goalSlot} = 0 WHERE townID = @townID
            UPDATE TownContributions SET progress_${goalSlot} = 0 WHERE townID = @townID
        `)

        return {
            message: "SUCCESS"
        }
    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





