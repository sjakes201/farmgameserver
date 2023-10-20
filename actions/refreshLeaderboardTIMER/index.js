const CONSTANTS = require('../shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (leaderboardCycle) {
    if (process.env.NODE_ENV === 'TESTING') {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }
    /*
    Will sort all leaderboards 
    Leaderboard is total, so based on Profiles data
    TempLeaderboard is weekly, so based on TempLeaderboardSum
    A player's data in the column for their UserID is their leaderboard position for that category
    Players need to be inserted into this upon logging in
*/

    let connection;
    let transaction;
    let request;
    let allCategories = CONSTANTS.Init_Market_Prices;
    // add Balance as category
    allCategories.Balance = null;
    allCategories.XP = null;

    const leaderboardCycles = {
        cycle1: ["carrot", "melon", "cauliflower", "pumpkin", "yam", "Balance", "XP"],
        cycle2: ["bamboo", "hops", "corn", "potato", "blueberry", "grape", "parsnip"],
        cycle3: ["oats", "strawberry", "cow_milk", "chicken_egg", "duck_egg", "quail_egg", "beet"],
        cycle4: ["yak_milk", "sheep_wool", "goat_milk", "ostrich_egg", "llama_wool", "kiwi_egg"]
    }

    try {
        connection = await poolPromise;

        for (const category in allCategories) {
            try {
                if (!leaderboardCycles[`cycle${leaderboardCycle}`].includes(category)) {
                    continue;
                }
                transaction = new sql.Transaction(connection);
                await transaction.begin();

                request = new sql.Request(transaction);

                let fetchQuery = '';
                if (category === 'Balance') {
                    fetchQuery = `SELECT UserID, Balance AS Value FROM Profiles`;
                } else if (category === 'XP') {
                    fetchQuery = `SELECT UserID, XP AS Value FROM Profiles`;
                } else {
                    fetchQuery = `SELECT UserID, ${category} AS Value FROM LeaderboardSum`;
                }

                // Create temporary table
                await request.query(`
                    CREATE TABLE ##TempData_${category} (
                        UserID INT,
                        Value INT,
                        Rank INT
                    );
        
                    INSERT INTO ##TempData_${category} (UserID, Value)
                    ${fetchQuery};
                `);


                // Update rank in temporary table
                await request.query(`
                    WITH Ranked AS (
                        SELECT UserID, Value, ROW_NUMBER() OVER (ORDER BY Value DESC) AS Rank
                        FROM ##TempData_${category}
                    )
                    UPDATE t
                    SET t.Rank = r.Rank
                    FROM ##TempData_${category} t
                    JOIN Ranked r ON t.UserID = r.UserID;
                `);


                // Update the main leaderboard using a join with the temporary table
                await request.query(`
                    UPDATE l
                    SET l.${category} = t.Rank
                    FROM Leaderboard l
                    JOIN ##TempData_${category} t ON l.UserID = t.UserID;
                `);


                const top3Result = await request.query(`
                SELECT TOP 3 UserID, Value
                FROM ##TempData_${category}
                ORDER BY Rank ASC;
                `);

                if (top3Result.recordset?.length === 3) {
                    podiumQuery = `
                    UPDATE LeaderboardPodium SET
                    firstUsername = (SELECT Username FROM Logins WHERE UserID = ${top3Result.recordset[0].UserID}),
                    firstCount = ${top3Result.recordset[0].Value},

                    secondUsername = (SELECT Username FROM Logins WHERE UserID = ${top3Result.recordset[1].UserID}),
                    secondCount = ${top3Result.recordset[1].Value},
                    
                    thirdUsername = (SELECT Username FROM Logins WHERE UserID = ${top3Result.recordset[2].UserID}),
                    thirdCount = ${top3Result.recordset[2].Value}

                    WHERE category = '${category}' AND leaderboardType = 'ALLTIME'
                    `
                    await request.query(podiumQuery)
                }

                await request.query(`DROP TABLE ##TempData_${category};`);

                // Update LeaderboardPodium for top 3

                await transaction.commit();
            } catch (error) {
                console.error(`Error processing category ${category}:`, error);
                if (transaction) {
                    await transaction.rollback();
                }
            }
        }

        // UPDATE TEMP LEADERBOARD
        // remove Balance as temp leaderboard category
        delete allCategories.Balance;
        delete allCategories.XP;

        for (const category in allCategories) {
            try {
                if (!leaderboardCycles[`cycle${leaderboardCycle}`].includes(category)) {
                    continue;
                }
                transaction = new sql.Transaction(connection);
                await transaction.begin();

                request = new sql.Request(transaction);

                let fetchQuery = `SELECT UserID, ${category} AS Value FROM TempLeaderboardSum`;


                // Create temporary table
                await request.query(`
                    CREATE TABLE ##TempData_Temp_${category} (
                        UserID INT,
                        Value INT,
                        Rank INT
                    );
        
                    INSERT INTO ##TempData_Temp_${category} (UserID, Value)
                    ${fetchQuery};
                `);


                // Update rank in temporary table
                await request.query(`
                    WITH Ranked AS (
                        SELECT UserID, Value, ROW_NUMBER() OVER (ORDER BY Value DESC) AS Rank
                        FROM ##TempData_Temp_${category}
                    )
                    UPDATE t
                    SET t.Rank = r.Rank
                    FROM ##TempData_Temp_${category} t
                    JOIN Ranked r ON t.UserID = r.UserID;
                `);


                // Update the main leaderboard using a join with the temporary table
                await request.query(`
                    UPDATE l
                    SET l.${category} = t.Rank
                    FROM TempLeaderboard l
                    JOIN ##TempData_Temp_${category} t ON l.UserID = t.UserID;
                `);

                // Set podium
                const top3Result = await request.query(`
                SELECT TOP 3 UserID, Value
                FROM ##TempData_Temp_${category}
                ORDER BY Rank ASC;
                `);

                if (top3Result.recordset?.length === 3) {
                    podiumQuery = `
                    UPDATE LeaderboardPodium SET
                    firstUsername = (SELECT Username FROM Logins WHERE UserID = ${top3Result.recordset[0].UserID}),
                    firstCount = ${top3Result.recordset[0].Value},

                    secondUsername = (SELECT Username FROM Logins WHERE UserID = ${top3Result.recordset[1].UserID}),
                    secondCount = ${top3Result.recordset[1].Value},
                    
                    thirdUsername = (SELECT Username FROM Logins WHERE UserID = ${top3Result.recordset[2].UserID}),
                    thirdCount = ${top3Result.recordset[2].Value}

                    WHERE category = '${category}' AND leaderboardType = 'WEEKLY'
                    `
                    await request.query(podiumQuery)
                }

                await request.query(`DROP TABLE ##TempData_Temp_${category};`);

                await transaction.commit();
            } catch (error) {
                console.error(`Error processing category ${category}:`, error);
                if (transaction) {
                    await transaction.rollback();
                }
            }
        }

    } catch (error) {
        console.log("DATABASE CONNECTION FAILURE");
        if (transaction) {
            await transaction.rollback();
        }
    }

};





