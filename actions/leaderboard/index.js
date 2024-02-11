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

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection)
        request.multiple = true;
        request.input('UserID', sql.Int, UserID);

        // for new players, is total num of players (tied for last)
        let numPlayersQuery = await request.query(`SELECT MAX(UserID) AS totalPlayers FROM TempLeaderboard`);

        let lbQuery = await request.query(`
        SELECT * FROM LeaderboardPodium
        SELECT * FROM Leaderboard WHERE UserID = @UserID
        SELECT * FROM TempLeaderboard WHERE UserID = @UserID
        `);

        const lbPodiumData = lbQuery.recordsets[0];
        const playerAllTimePos = lbQuery.recordsets[1][0];
        const playerWeeklyPos = lbQuery.recordsets[2][0];

        const totalPlayers = numPlayersQuery.recordset[0].totalPlayers

        lbPodiumData.forEach((row) => {
            if (row.leaderboardType === 'WEEKLY') {
                let podiumSlotInfo = {
                    first: {
                        Username: row.firstUsername,
                        [row.category]: row.firstCount
                    },
                    second: {
                        Username: row.secondUsername,
                        [row.category]: row.secondCount
                    },
                    third: {
                        Username: row.thirdUsername,
                        [row.category]: row.thirdCount
                    },
                    you: playerWeeklyPos[row.category] === -1 ? totalPlayers : playerWeeklyPos[row.category]
                }
                tempResult[row.category] = podiumSlotInfo
            } else {
                let podiumSlotInfo = {
                    first: {
                        Username: row.firstUsername,
                        [row.category]: row.firstCount
                    },
                    second: {
                        Username: row.secondUsername,
                        [row.category]: row.secondCount
                    },
                    third: {
                        Username: row.thirdUsername,
                        [row.category]: row.thirdCount
                    },
                    you: playerAllTimePos[row.category] === -1 ? totalPlayers : playerAllTimePos[row.category]
                }
                totalResult[row.category] = podiumSlotInfo
            }
        });

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





