const CONSTANTS = require('../shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 



/*
    Each leaderboard object of objects, each entry key is the category, value is the results:
    {
        "category name": {
            first: { Username: 'moreeggs', chicken_egg: 25 },
            second: { Username: 'lessegds', chicken_egg: 22 },
            third: { Username: 'LotsOEgg', chicken_egg: 17 },
            you: 15,
        },
        ...
    }
*/

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    let tempResult = {};
    let totalResult = {};
    let allCategories = { ...CONSTANTS.Init_Market_Prices };

    let connection;
    try {
        connection = await poolPromise;
        // for new players, is total
        let numPlayersQuery = await connection.query(`SELECT COUNT(*) FROM TempLeaderboard`);

        // Build temp leaderboard stats
        for (category in allCategories) {
            let topThree = await connection.query(`
                SELECT UserID, Username, ${category} 
                FROM TempLeaderboard 
                WHERE ${category} IN (1, 2, 3)
                ORDER BY CASE ${category}
                    WHEN 1 THEN 1
                    WHEN 2 THEN 2
                    WHEN 3 THEN 3
                    ELSE 4
                END
            `);

            let firstUserID = topThree.recordset[0].UserID, secondUserID = topThree.recordset[1].UserID, thirdUserID = topThree.recordset[2].UserID;
            let firstUsername = topThree.recordset[0].Username, secondUsername = topThree.recordset[1].Username, thirdUsername = topThree.recordset[2].Username;

            let yourPosition = await connection.query(`
                SELECT ${category} FROM TempLeaderboard WHERE UserID = ${UserID}
            `);
            let threeCounts = await connection.query(`
                SELECT ${category} 
                FROM TempLeaderboardSum 
                WHERE UserID IN (${firstUserID}, ${secondUserID}, ${thirdUserID})
                ORDER BY CASE UserID
                    WHEN ${firstUserID} THEN 1
                    WHEN ${secondUserID} THEN 2
                    WHEN ${thirdUserID} THEN 3
                    ELSE 4
                END
            `)

            let yourPlace = yourPosition.recordset[0][category];
            if (yourPlace === -1) {
                // new user, make 'you' = to number of people in game since you're technically tied for last
                yourPlace = numPlayersQuery.recordset[0][''];
            }

            let categoryInfo = {
                "first": {
                    Username: firstUsername,
                    [category]: threeCounts.recordset[0][category]
                },
                "second": {
                    Username: secondUsername,
                    [category]: threeCounts.recordset[1][category]
                },
                "third": {
                    Username: thirdUsername,
                    [category]: threeCounts.recordset[2][category]
                },
                "you": yourPlace
            }
            tempResult[category] = categoryInfo;
        }

        // build all time leaderboard stats
        allCategories.Balance = null;
        allCategories.XP = null;
        for (category in allCategories) {
            let topThree = await connection.query(`
                SELECT UserID, Username, ${category} 
                FROM Leaderboard 
                WHERE ${category} IN (1, 2, 3)
                ORDER BY CASE ${category}
                    WHEN 1 THEN 1
                    WHEN 2 THEN 2
                    WHEN 3 THEN 3
                    ELSE 4
                END
            `);

            let firstUserID = topThree.recordset[0].UserID, secondUserID = topThree.recordset[1].UserID, thirdUserID = topThree.recordset[2].UserID;
            let firstUsername = topThree.recordset[0].Username, secondUsername = topThree.recordset[1].Username, thirdUsername = topThree.recordset[2].Username;


            let yourPosition = await connection.query(`
            SELECT ${category} FROM Leaderboard WHERE UserID = ${UserID}
            `);
            let threeCounts = await connection.query(`
            SELECT ${category} 
            FROM ${category === "Balance" || category === "XP" ? "Profiles" : "LeaderboardSum"} 
            WHERE UserID IN (${firstUserID}, ${secondUserID}, ${thirdUserID})
            ORDER BY CASE UserID
                WHEN ${firstUserID} THEN 1
                WHEN ${secondUserID} THEN 2
                WHEN ${thirdUserID} THEN 3
                ELSE 4
            END
            `)

            let yourPlace = yourPosition.recordset[0][category];
            if (yourPlace === -1) {
                // new user, make 'you' = to number of people in game since you're technically tied for last
                yourPlace = numPlayersQuery.recordset[0][''];
            }

            let categoryInfo = {
                "first": {
                    Username: firstUsername,
                    [category]: threeCounts.recordset[0][category]
                },
                "second": {
                    Username: secondUsername,
                    [category]: threeCounts.recordset[1][category]
                },
                "third": {
                    Username: thirdUsername,
                    [category]: threeCounts.recordset[2][category]
                },
                "you": yourPlace
            }
            totalResult[category] = categoryInfo;
        }

        return {
            tempLeaderboard: tempResult,
            allTimeLeaderboard: totalResult,
        }
    } catch (error) {
        console.log(error)
        return {
            message: "FAILED TO COMPUTE LEADERBOARD"
        }
    } 
}





