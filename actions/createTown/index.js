const sql = require('mssql');
const { poolPromise } = require('../db'); 
const TOWNINFO = require('../shared/TOWNINFO');

module.exports = async function (ws, actionData) {

    // const UserID = ws.UserID;
    const UserID = actionData.UserID;


    // INPUTS
    let townName = actionData.townName;
    if (typeof townName !== 'string' || townName.length > 32) {
        ws.send(JSON.stringify( {
            status: 400,
            body: {
                message: "Invalid town name, must be string 32 chars max"
            }
        }));
        return;
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
            // Create the town without UserID to get the next townID, need to do this outside transaction because of SQL table access order standards
            let claimTownID = await request.query(`
                INSERT INTO Towns (townName, townDescription, memberCount) 
                OUTPUT INSERTED.townID
                VALUES (@townName, @defaultDescription, 1) 
            `)
            let generatedTownID = claimTownID.recordset[0].townID;

            // Check for already being in a town (SQL -Towns +Profiles)
            request.input('townID', sql.Int, generatedTownID)
            let changeTownQuery = await request.query(`
                SELECT townID FROM Profiles WHERE UserID = @UserID
                UPDATE Profiles SET townID = @townID WHERE UserID = @UserID
            `)
            if (changeTownQuery.recordset[0].townID !== -1) {
                // Remove town from database, they were already in one (on connection, not transaction)
                await transaction.rollback();
                await connection.query(`
                DELETE FROM Towns WHERE townID = ${generatedTownID}
                `)
                ws.send(JSON.stringify( {
                    status: 400,
                    body: {
                        message: "Already in a town, leave before creating a new one"
                    }
                }));
                return;
            }

            // Claim leadership of town after profile verficiation of not already being in a town
            let townCreateQuery = await request.query(`
                UPDATE Towns SET leader = @UserID WHERE townID = @townID
            `)


            // MSSQL Create row in town goals, using townID (SQL -Towns +TownGoals)
            await request.query(`
            INSERT INTO TownGoals (townID, goal_1, goal_2, goal_3, goal_4, goal_5, goal_6, goal_7, goal_8)
            VALUES (@townID, '${TOWNINFO.starterGoals.goal_1}','${TOWNINFO.starterGoals.goal_2}','${TOWNINFO.starterGoals.goal_3}','${TOWNINFO.starterGoals.goal_4}', '${TOWNINFO.starterGoals.goal_5}', '${TOWNINFO.starterGoals.goal_6}', '${TOWNINFO.starterGoals.goal_7}', '${TOWNINFO.starterGoals.goal_8}')
            `)

            await transaction.commit()
            ws.send(JSON.stringify( {
                // status: 200, /* Defaults to 200 */
                body: { msg: 'SUCCESS' }
            }));
        } catch (sqlError) {
            if (sqlError.number === 2601 || sqlError.number === 2627) {
                // Unique constraint violation error (error code 2601 or 2627)
                ws.send(JSON.stringify( {
                    status: 400,
                    body: {
                        message: "Unique constraint violation. The provided townName is not unique or the leader already owns a town."
                    }
                }));
            } else {
                // Other SQL error
                throw sqlError; // Re-throw the error for generic error handling
            }
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        ws.send(JSON.stringify( {
            status: 500,
            body: {
                message: "UNCAUGHT ERROR"
            }
        }));
        return;
    } 





}





