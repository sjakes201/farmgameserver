const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    let targetGoalID = actionData.targetGoalID;

    if(![1,2,3,4,5,6,7,8,9,10,11,12].includes(targetGoalID)) {
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

        // Check their town (SQL +TownMembers)
        let townIDQuery = await request.query(`
            SELECT townID FROM TownMembers WHERE UserID = @UserID
        `)
        if(townIDQuery.recordset.length === 0) {
            await transaction.rollback();
            return {
                success: false,
                message: "Not in a town"
            }
        }
        // Claim goal if not already doing one (SQL -TownMembers +IndividualTownGoals)
        request.input('townID', sql.Int, townIDQuery.recordset[0].townID)
        const goalExpirationMS = Date.now() + TOWNINFO.VALUES.indivGoalExpiryMS;
        request.input('goalExpiration', sql.BigInt, goalExpirationMS)
        request.multiple = true;
        let claimQuery = await request.query(`
            SELECT
            CASE
                WHEN EXISTS (SELECT 1 FROM IndividualTownGoals WHERE UserID = @UserID AND townID = @townID)
                THEN 'true' 
                ELSE 'false' 
            END AS alreadyClaimedAGoal

            SELECT UserID FROM IndividualTownGoals WHERE townID = @townID AND goalID = @goalID
            
            UPDATE IndividualTownGoals SET UserID = @UserID, Expiration = @goalExpiration WHERE townID = @townID AND goalID = @goalID
        `)
        if(Number.isInteger(claimQuery.recordsets[1][0].UserID)) {
                await transaction.rollback();
                return {
                    success: false,
                    message: "Someone else is already doing that goal"
                }
        }
        const alreadyHadGoal = claimQuery.recordset[0].alreadyClaimedAGoal;
        if(alreadyHadGoal === 'true') {
            await transaction.rollback();
            return {
                success: false,
                message: "You can only claim 1 individual goal at a time"
            }
        }
        const claimedGoal = claimQuery.rowsAffected[1] === 1;
        if(!claimedGoal) {
            await transaction.rollback();
            return {
                success: false,
                message: `Error claiming individual goal number ${targetGoalID}`
            }
        }
        await transaction.commit();
        return {
            success: true,
            message: "Successfully claimed goal",
            expiration: goalExpirationMS
        }

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }





}





