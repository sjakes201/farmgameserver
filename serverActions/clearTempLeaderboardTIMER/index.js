const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function () {
    if (process.env.NODE_ENV === "TESTING") {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }


    const timestamp = Date.now();
    const allCategories = ["carrot", "melon", "cauliflower", "pumpkin", "yam", "beet",
        "parsnip", "bamboo", "hops", "corn", "potato", "blueberry", "grape", "oats", "strawberry",
        "cow_milk", "chicken_egg", "duck_egg", "quail_egg", "yak_milk", "sheep_wool", "goat_milk",
        "ostrich_egg", "llama_wool", "kiwi_egg"]

    const givePremiumCurrencyReward = async (connection, category, isTempLeaderboard) => {
        let transaction = new sql.Transaction(connection);
        await transaction.begin()
        let request = new sql.Request(transaction);

        const leaderboardType = isTempLeaderboard ? "templeaderboard" : "leaderboard";
        const leaderboardTable = isTempLeaderboard ? "TempLeaderboard" : "Leaderboard";
        try {
            let giveQuery = await request.query(`
                    INSERT INTO UserNotifications (UserID, Timestamp, Type, Message)
                    SELECT 
                        P.UserID,
                        ${timestamp},
                        'LEADERBOARD_PREMIUM_REWARD',
                        (SELECT 
                            '${leaderboardType}' AS [type], 
                            '${category}' AS [category], 
                            L.${category} AS [position], 
                            CASE 
                                WHEN L.${category} BETWEEN 15 AND 24 THEN 4
                                WHEN L.${category} BETWEEN 8 AND 14 THEN 5
                                WHEN L.${category} IN (6, 7) THEN 10
                                WHEN L.${category} IN (4, 5) THEN 15
                                WHEN L.${category} = 3 THEN 25
                                WHEN L.${category} = 2 THEN 35
                                WHEN L.${category} = 1 THEN 50
                                ELSE 3
                            END AS [reward] 
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
                    FROM Profiles P
                    INNER JOIN ${leaderboardTable} L ON P.UserID = L.UserID
                    WHERE L.${category} BETWEEN 1 AND 50;
                `);
            console.log(`Successfully gave premium currency rewards for ${category} ${leaderboardType}`);
            await transaction.commit();
            return true;
        } catch (error) {
            console.error('Error executing givePremiumCurrencyReward:', error);
            if (transaction) await transaction.rollback();
            return false;
        }
    }


    let connection;
    try {
        connection = await poolPromise;

        for (const category of allCategories) {
            await givePremiumCurrencyReward(connection, category, false)
                .catch(error => console.log(`Error giving premium currency reward for category: ${category}`, error));
        }

        for (const category of allCategories) {
            await givePremiumCurrencyReward(connection, category, true)
                .catch(error => console.log(`Error giving temp leaderboard premium currency reward for category: ${category}`, error));
        }

        let reset = await connection.query(`
            UPDATE TempLeaderboardSum
            SET carrot = 0, melon = 0, cauliflower = 0, pumpkin = 0, yam = 0, beet = 0, parsnip = 0, bamboo = 0, hops = 0, corn = 0,
            potato = 0, blueberry = 0, grape = 0, oats = 0, strawberry = 0, cow_milk = 0, chicken_egg = 0, duck_egg = 0, quail_egg = 0,
            yak_milk = 0, sheep_wool = 0, goat_milk = 0, ostrich_egg = 0, llama_wool = 0, kiwi_egg = 0
        `)
        if (reset.rowsAffected[0] === 0) {
            console.log("Error resetting temp leaderboard");
            return;
        }

        console.log("Successfully reset temp leaderboard")
    } catch (error) {
        console.log(error);
    }
}





