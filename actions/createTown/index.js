const sql = require('mssql');
const { poolPromise } = require('../../db');
const TOWNINFO = require('../shared/TOWNINFO');
const { giveUnlockID } = require('../../unlockFunctions')
const { allNewIndividualGoals } = require('../shared/townHelpers')

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
            // MSSQL create 10 random starter individual town goals, at least always 5 
            const individualGoals = await allNewIndividualGoals();
            // MSSQL Create row in town goals, using townID (SQL -Towns +-IndividualTownGoals +-TownGoals +TownContributions)
            await request.query(`
            INSERT INTO IndividualTownGoals (Good, Quantity, townFunds, townID, goalID) VALUES 
            ('${individualGoals[0].Good}', '${individualGoals[0].Quantity}', ${individualGoals[0].townFunds}, @townID, 1),
            ('${individualGoals[1].Good}', '${individualGoals[1].Quantity}', ${individualGoals[1].townFunds}, @townID, 2),
            ('${individualGoals[2].Good}', '${individualGoals[2].Quantity}', ${individualGoals[2].townFunds}, @townID, 3),
            ('${individualGoals[3].Good}', '${individualGoals[3].Quantity}', ${individualGoals[3].townFunds}, @townID, 4),
            ('${individualGoals[4].Good}', '${individualGoals[4].Quantity}', ${individualGoals[4].townFunds}, @townID, 5),
            ('${individualGoals[5].Good}', '${individualGoals[5].Quantity}', ${individualGoals[5].townFunds}, @townID, 6),
            ('${individualGoals[6].Good}', '${individualGoals[6].Quantity}', ${individualGoals[6].townFunds}, @townID, 7),
            ('${individualGoals[7].Good}', '${individualGoals[7].Quantity}', ${individualGoals[7].townFunds}, @townID, 8),
            ('${individualGoals[8].Good}', '${individualGoals[8].Quantity}', ${individualGoals[8].townFunds}, @townID, 9),
            ('${individualGoals[9].Good}', '${individualGoals[9].Quantity}', ${individualGoals[9].townFunds}, @townID, 10),
            ('${individualGoals[10].Good}', '${individualGoals[10].Quantity}', ${individualGoals[10].townFunds}, @townID, 11),
            ('${individualGoals[11].Good}', '${individualGoals[11].Quantity}', ${individualGoals[11].townFunds}, @townID, 12);
            

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
            INSERT INTO TownPurchases (townID) VALUES (@townID)
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





