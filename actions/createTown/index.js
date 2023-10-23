const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO');
const { giveUnlockID } = require('../../unlockFunctions')

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    // INPUTS
    let townName = actionData.townName;
    const isValid = /^[A-Za-z0-9._]{4,32}$/.test(townName);
    if (typeof townName !== 'string' || !isValid) {
        return {
            message: "Invalid town name, must be string [4,32] chars and include letters, numbers, period and underscore only"
        };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;



        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);
        request.input(`townName`, sql.VarChar(32), townName);
        request.input(`defaultDescription`, sql.VarChar(64), 'A brand new Town.')


        try {
            // Create the town without UserID to get the next townID, DOES NOT OBEY SQL ACCESS ORDER STANDARDS NEED TO FIX
            let claimTownID = await request.query(`
                INSERT INTO Towns (townName, townDescription, memberCount) 
                OUTPUT INSERTED.townID
                VALUES (@townName, @defaultDescription, 1) 
            `)
            let generatedTownID = claimTownID.recordset[0].townID;
            request.input('townID', sql.Int, generatedTownID)

            let checkMemberQuery = await request.query(`
                SELECT townID FROM TownMembers WHERE UserID = @UserID
            `)
            if (checkMemberQuery.recordset.length !== 0) {
                await transaction.rollback();
                return {
                    message: "Already in a town"
                }
            } else {
                // 4 is role id for leader
                let createMember = await request.query(`
                    INSERT INTO TownMembers (UserID, RoleID, townID) VALUES (@UserID, 4, @townID)
                `)
            }

            // MSSQL Create row in town goals, using townID (SQL -Towns +-TownGoals +TownContributions)
            await request.query(`
            INSERT INTO TownGoals (townID, goal_1, goal_2, goal_3, goal_4, goal_5, goal_6, goal_7, goal_8)
            VALUES (@townID, 
            '${TOWNINFO.starterGoals.goal_1} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_1]}',
            '${TOWNINFO.starterGoals.goal_2} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_2]}',
            '${TOWNINFO.starterGoals.goal_3} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_3]}',
            '${TOWNINFO.starterGoals.goal_4} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_4]}',
            '${TOWNINFO.starterGoals.goal_5} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_5]}',
            '${TOWNINFO.starterGoals.goal_6} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_6]}', 
            '${TOWNINFO.starterGoals.goal_7} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_7]}',
            '${TOWNINFO.starterGoals.goal_8} ${TOWNINFO.goalQuantities[TOWNINFO.starterGoals.goal_8]}'
            )
            UPDATE TownContributions SET townID = @townID WHERE UserID = @UserID
            `)

            await transaction.commit()
            giveUnlockID(UserID, 9)
            return { message: 'SUCCESS' }
        } catch (sqlError) {
            console.log(sqlError)
            if (sqlError.number === 2601 || sqlError.number === 2627) {
                // Unique constraint violation error (error code 2601 or 2627)
                if (transaction) await transaction.rollback()
                return {
                    message: "Unique constraint violation. The provided townName is not unique or the leader already owns a town."
                }
            } else {
                // Other SQL error
                throw sqlError; // Re-throw the error for generic error handling
            }
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "UNCAUGHT ERROR"
        };
    }





}





