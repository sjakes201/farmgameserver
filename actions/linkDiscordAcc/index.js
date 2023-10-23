const axios = require('axios');
const qs = require("qs");
const { poolPromise } = require('../../db');
const sql = require('mssql');
const { giveUnlockID } = require('../../unlockFunctions');


module.exports = async function (ws, actionData) {
    let code = actionData.code;
    let UserID = ws.UserID;

    let connection;
    let transaction;
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', qs.stringify({
            client_id: '1143367795682320434',
            client_secret: '320UL9hiVu6WpjR3QwaVfhhdpn1KZhW5',
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'https://farmgame.live/discordAuth',
            scope: 'identify'
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // Use the access token to get user's Discord ID
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        let discordID = userResponse.data.id;
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input("UserID", sql.Int, UserID);
        request.input("discordID", sql.VarChar(64), discordID);

        let alreadyExists = await request.query(`SELECT DiscordID FROM DiscordData WHERE UserID = @UserID`)
        if (alreadyExists.recordset.length === 0) {
            let linkQuery = await request.query(`INSERT INTO DiscordData (UserID, DiscordID) VALUES (@UserID, @discordID)`)
        } else {
            let linkQuery = await request.query(`UPDATE DiscordData SET DiscordID = @discordID WHERE UserID = @UserID`)
        }
        await transaction.commit();
        giveUnlockID(UserID, 11)

        return {
            message: "success"
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback();
        return {
            message: "error"
        }
    }


}
