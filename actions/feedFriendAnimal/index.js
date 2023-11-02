const sql = require('mssql');
const { poolPromise } = require('../../db');
const { sendUserData } = require('../../broadcastFunctions');

const MS_FRIEND_FEED_COOLDOWN = 30 * 60 * 1000

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;
    const targetUsername = actionData.targetUsername;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection)
        await transaction.begin();
        let request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID)
        request.input('targetUsername', sql.NVarChar, targetUsername);

        // Get target UserID (SQL +Logins)
        let targetUserQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @targetUsername
        `)
        const targetUserID = targetUserQuery.recordset?.[0]?.UserID
        request.input('targetUserID', sql.Int, targetUserID)

        if (!targetUserID) {
            await transaction.rollback();
            return {
                success: false,
                message: `User with target username '${targetUsername}' does not exist`
            }
        }

        // Increase random happiness and set last feed (SQL -Logins +Animals)
        let increaseHappiness = await request.query(`
        DECLARE @UpdatedAnimals TABLE (Animal_ID INT);
        WITH RankedAnimals AS (
            SELECT
                Animal_ID,
                Happiness,
                ROW_NUMBER() OVER (ORDER BY Happiness ASC, Animal_ID ASC) AS rn
            FROM
                Animals
            WHERE
                UserID = @targetUserID
        )
        UPDATE A
        SET A.Happiness = A.Happiness + 0.2
        OUTPUT INSERTED.Animal_ID INTO @UpdatedAnimals
        FROM
            Animals A
        INNER JOIN
            RankedAnimals RA ON A.Animal_ID = RA.Animal_ID AND A.UserID = @targetUserID
        WHERE
            RA.rn = 1 AND A.Happiness < 1.2;

        SELECT Animal_ID FROM @UpdatedAnimals;
                    
        `)
        const fedAnimalID = increaseHappiness.recordset?.[0]?.Animal_ID

        // Check if cooldown had passed and you were friends (SQL -Animals +Friends)
        let cooldownQuery = await request.query(`
            SELECT senderUserID, receiverUserID, senderLastFeed, receiverLastFeed FROM Friends 
            WHERE (senderUserID = @UserID AND receiverUserID = @targetUserID) OR (senderUserID = @targetUserID AND receiverUserID = @UserID)
        `)
        if (cooldownQuery.recordset.length === 0) {
            await transaction.rollback();
            return {
                success: false,
                message: "You are not friends with this user."
            }
        }

        let updateCooldownQuery;
        if (cooldownQuery.recordset[0].senderUserID === UserID) {
            updateCooldownQuery = await request.query(`
                SELECT senderLastFeed AS yourLastFeed FROM Friends WHERE senderUserID = @UserID AND receiverUserID = @targetUserID
                UPDATE Friends SET senderLastFeed = ${Date.now()} WHERE senderUserID = @UserID AND receiverUserID = @targetUserID
            `)
        } else {
            updateCooldownQuery = await request.query(`
                SELECT receiverLastFeed AS yourLastFeed FROM Friends WHERE senderUserID = @targetUserID AND receiverUserID = @UserID
                UPDATE Friends SET receiverLastFeed = ${Date.now()} WHERE senderUserID = @targetUserID AND receiverUserID = @UserID
            `)
        }
        let yourLastFeed = Number(updateCooldownQuery.recordset[0].yourLastFeed)

        if (yourLastFeed + MS_FRIEND_FEED_COOLDOWN > Date.now()) {
            await transaction.rollback()
            return {
                success: false,
                message: "Feed cooldown"
            }
        }
        await transaction.commit();
        if (fedAnimalID !== undefined) {
            sendUserData(targetUserID, 'animal_was_fed', { Animal_ID: fedAnimalID, Happiness: 0.2 })
        }
        return {
            success: true
        }

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback();
        return {
            success: false,
            message: "Uncaught error"
        };
    }
}





