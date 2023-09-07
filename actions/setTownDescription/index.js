const sql = require('mssql');
const { poolPromise } = require('../db'); 


module.exports = async function (ws, actionData) {

    // const UserID = ws.UserID;
    const UserID = actionData.UserID;


    let newDescription = actionData.newDescription;

    if(typeof newDescription !== 'string' || newDescription.length > 128) {
        ws.send(JSON.stringify( {
            status: 400,
            body: {
                message: 'Invalid town description, must be < 128 char string'
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
        request.input(`newDescription`, sql.VarChar(128), newDescription)

        // Get your townID (SQL +Profiles)
        let townIDQuery = await request.query(`
        SELECT townID FROM Profiles WHERE UserID =@UserID
        `)
        let yourTownID = townIDQuery.recordset[0].townID
        if (yourTownID === -1) {
            await transaction.rollback();
            ws.send(JSON.stringify( {
                status: 400,
                body: {
                    message: "You are not in a town"
                }
            }));
            return;
        }
        // Set description and check you are leader (SQL -Profiles +Towns)
        request.input('townID', sql.Int, yourTownID)
        let changeQuery = await request.query(`
            SELECT leader FROM Towns WHERE townID = @townID
            UPDATE Towns SET townDescription = @newDescription WHERE townID = @townID
        `)
        let leaderUserID = changeQuery.recordset[0].leader;
        if (leaderUserID !== UserID) {
            await transaction.rollback();
            ws.send(JSON.stringify( {
                status: 400,
                body: {
                    message: "Only the leader of this town can change the description"
                }
            }));
            return;
        }

        await transaction.commit();
        ws.send(JSON.stringify( {
            status: 200,
            body: {
                message: "SUCCESS"
            }
        }));
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





