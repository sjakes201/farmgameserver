const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO')
const { newIndividualGoal } = require('../shared/townHelpers')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    let targetGoalID = actionData.targetGoalID;

    if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(targetGoalID)) {
        return {
            success: false,
            message: `Invalid goal ID ${targetGoalID}`
        }
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input('goalID', sql.Int, targetGoalID);

        // Check their town (SQL +-TownMembers +IndividualTownGoals)
        let townIDQuery = await request.query(`
            SELECT TM.townID, ITG.Good
            FROM TownMembers TM
            LEFT JOIN IndividualTownGoals ITG ON ITG.townID = TM.townID
            WHERE TM.UserID = @UserID AND ITG.goalID != @goalID;
        `)
        if (townIDQuery.recordset.length === 0) {
            await transaction.rollback();
            return {
                success: false,
                message: "Not in a town"
            }
        }
        const currentCrops = townIDQuery.recordset.map((goal) => goal.Good);
        const [newGood, newQty] = newIndividualGoal(currentCrops)

        request.input('townID', sql.Int, townIDQuery.recordsets[0][0].townID)
        request.input('newGood', sql.NVarChar(64), newGood)
        request.input('newQty', sql.Int, newQty)

        let resetQuery = await request.query(`
            SELECT Expiration FROM IndividualTownGoals WHERE townID = @townID AND goalID = @goalID
            UPDATE IndividualTownGoals SET UserID = NULL, Good = @newGood, Quantity = @newQty, Expiration = NULL, progress = 0 WHERE townID = @townID AND goalID = @goalID
        `)
        const goalExpiration = resetQuery.recordset[0].Expiration;
        if (!goalExpiration || goalExpiration > (Date.now() - TOWNINFO.VALUES.indivGoalExpiryMS)) {
            await transaction.rollback();
            return {
                success: false,
                message: 'Goal has not expired'
            }
        }
        await transaction.commit();
        return {
            success: true,
            message: "Successfully reset goal",
            newGood: newGood,
            newQty: newQty
        }

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}
