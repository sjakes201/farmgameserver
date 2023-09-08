const CONSTANTS = require('../shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function () {
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

    try {connection = await poolPromise;

        for (const category in allCategories) {
            // repeat for every category (all goods + Balance)
            try {
                transaction = new sql.Transaction(connection);
                await transaction.begin();
                request = new sql.Request(transaction);
                // Initiate for this column
                let allPlayersQuery;
                if (category === 'Balance') {
                    allPlayersQuery = await request.query(`SELECT UserID, Balance FROM Profiles`);
                } else if (category === 'XP') {
                    allPlayersQuery = await request.query(`SELECT UserID, XP FROM Profiles`);

                } else {
                    allPlayersQuery = await request.query(`SELECT UserID, ${category} FROM LeaderboardSum`);
                }

                let allPlayers = allPlayersQuery.recordset;
                // Sort this column
                allPlayers.sort((a, b) => b[category] - a[category]);


                // Build query to assign indices (leaderboard position) to column for user, 1000 users at a time
                let settingQuery = ``;
                for (let i = 0; i < allPlayers.length; ++i) {
                    settingQuery += `
                    UPDATE Leaderboard SET ${category} = ${i + 1} WHERE UserID = ${allPlayers[i].UserID};
                    `
                }
                await request.query(settingQuery);

                await transaction.commit();
                transaction = null;
                request = null;

                console.log(`SORTED ${category}`)
            } catch (error) {
                if (transaction) transaction.rollback();
                console.log(error);
            }
        }




        // UPDATE TEMP LEADERBOARD
        // remove Balance as temp leaderboard category
        delete allCategories.Balance;
        delete allCategories.XP;
        for (const category in allCategories) {

            // repeat for every category (all goods + Balance)
            try {

                transaction = new sql.Transaction(connection);
                await transaction.begin();
                request = new sql.Request(transaction);
                // Initiate for this column
                let allPlayersQuery = await request.query(`SELECT UserID, ${category} FROM TempLeaderboardSum`);
                let allPlayers = allPlayersQuery.recordset;
                // Sort this column
                allPlayers.sort((a, b) => b[category] - a[category]);
                // Build query to assign indices (leaderboard position) to column for user
                let settingQuery = ``;
                for (let i = 0; i < allPlayers.length; ++i) {
                    settingQuery += `
                    UPDATE TempLeaderboard SET ${category} = ${i + 1} WHERE UserID = ${allPlayers[i].UserID};
                    `
                }
                await request.query(settingQuery);
                await request.query(settingQuery);
                await transaction.commit();
                transaction = null;
                request = null;

                console.log(`SORTED ${category}`)
            } catch (error) {
                if (transaction) transaction.rollback();
                console.error(`Error processing category ${category}:`, error);

                // console.log(error);
            }
        }


    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log("DATABASE CONNECTION FAILURE");
    }

    // UPDATE ALLTIME LEADERBOARD


};





