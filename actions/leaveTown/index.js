const sql = require('mssql');
const { poolPromise } = require('../db'); 

module.exports = async function (ws, actionData) {

    // const UserID = ws.UserID;
    const UserID = actionData.UserID;


    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        transaction = new sql.Transaction(connection);
        await transaction.begin()
        const request = new sql.Request(transaction);
        request.input(`UserID`, sql.Int, UserID);

        // Set townID to -1 (default for no town) (SQL +Profiles)
        let profileTownQuery = await request.query(`
        SELECT townID FROM Profiles WHERE UserID = @UserID
        UPDATE Profiles SET townID = -1 WHERE UserID = @UserID
        `)
        if (profileTownQuery.recordset[0].townID === -1) {
            await transaction.rollback();
            ws.send(JSON.stringify( {
                status: 400,
                body: {
                    message: "Not in a town"
                }
            }));
            return;
        }

        request.input('townID', sql.Int, profileTownQuery.recordset[0].townID)
        // Decrement town and check logic for if you are leader (SQL -Profiles +Towns)
        let memberCountQuery = await request.query(`
        SELECT leader, memberCount FROM Towns WHERE townID = @townID
        UPDATE Towns SET memberCount = memberCount - 1 WHERE townID = @townID
        `)
        if (memberCountQuery.recordset[0].leader === UserID && memberCountQuery.recordset[0].memberCount > 1) {
            await transaction.rollback();
            ws.send(JSON.stringify( {
                status: 400,
                body: {
                    message: "Must promote new leader before leaving nonempty town"
                }
            }));
            return;
        }
        if (memberCountQuery.recordset[0].leader === UserID && memberCountQuery.recordset[0].memberCount === 1) {
            // They are the last person. Delete the town (SQL -Towns +TownGoals)
            await request.query(`
                DELETE FROM Towns WHERE townID = @townID
                DELETE FROM TownGoals WHERE townID = @townID
            `)

        }
        ws.send(JSON.stringify( {
            // status: 200, /* Defaults to 200 */
            body: {
                message: "SUCCESS"
            }
        }));

        await transaction.commit();
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





