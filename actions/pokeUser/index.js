const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    // GET USERID
    const UserID = ws.UserID;

    const targetUsername = actionData.targetUsername;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('targetUsername', sql.VarChar, targetUsername)

        let targetQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @targetUsername
        `)
        if(targetQuery.recordset.length === 0) {
            return {
                message: "User does not exist"
            }
        }
        
        transaction = new sql.Transaction(connection);
        await transaction.begin()
        let pokeRequest = new sql.Request(transaction);

        const targetUserID = targetQuery.recordset[0].UserID
        pokeRequest.input('targetUserID', sql.Int, targetUserID);
        pokeRequest.input('UserID', sql.Int, UserID);

        let pokeQuery = await pokeRequest.query(`
            UPDATE Profiles SET receivedPokes = receivedPokes + 1 WHERE UserID = @targetUserID
            SELECT lastPoke FROM Profiles WHERE UserID = @UserID
            UPDATE Profiles SET lastPoke = ${Date.now()} WHERE UserID = @UserID
        `)
        let lastPoke = pokeQuery.recordset[0].lastPoke;
        if(lastPoke > Date.now() - 1 * 60 * 1000) {
            await transaction.rollback();
            return {
                message: "Poke cooldown"
            }
        }
        await transaction.commit();
        return {
            message: 'Poke success!'
        };
    } catch (error) {
        if(transaction) transaction.rollback();
        console.log(error);
        return {
            message: 'Poke internal error'
        };
    }


}





