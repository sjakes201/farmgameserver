const sql = require('mssql');
const { poolPromise } = require('../db');

async function pokeUser(msgSenderID, targetUsername) {
    let connection;
    let transaction;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.multiple = true;
        request.input('targetUsername', sql.VarChar, targetUsername)
        request.input('senderDiscordID', sql.VarChar(64), msgSenderID)


        let targetQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @targetUsername
        SELECT UserID FROM DiscordData WHERE DiscordID = @senderDiscordID
        `)
        if(targetQuery.recordsets[1].length === 0) {
            return {
                message: "You need to link your Discord before poking!"
            }
        }
        if(targetQuery.recordsets[0].length === 0) {
            return {
                message: `User ${targetUsername} not found. User their in-game name.`
            }
        }

        let targetUserID = targetQuery.recordsets[0][0].UserID;
        let pokerUserID = targetQuery.recordsets[1][0].UserID;

        if(targetUserID === pokerUserID) {
            return {
                message: "\u{1F610}"
            }
        }
        
        transaction = new sql.Transaction(connection);
        await transaction.begin()
        let pokeRequest = new sql.Request(transaction);

        pokeRequest.input('targetUserID', sql.Int, targetUserID);
        pokeRequest.input('UserID', sql.Int, pokerUserID);

        let pokeQuery = await pokeRequest.query(`
            UPDATE Profiles SET receivedPokes = receivedPokes + 1 WHERE UserID = @targetUserID
            SELECT lastPoke FROM Profiles WHERE UserID = @UserID
            UPDATE Profiles SET lastPoke = ${Date.now()} WHERE UserID = @UserID
        `)
        let lastPoke = pokeQuery.recordset[0].lastPoke;
        if (lastPoke > Date.now() - 1 * 60 * 1000) {
            await transaction.rollback();
            return {
                message: "Poke cooldown"
            }
        }
        await transaction.commit();
        return {
            message: 'Poked!'
        };
    } catch (error) {
        if (transaction) transaction.rollback();
        console.log(error);
        return {
            message: 'Poke internal error'
        };
    }
}
module.exports = { pokeUser }