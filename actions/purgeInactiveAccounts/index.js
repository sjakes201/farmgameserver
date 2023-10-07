// const sql = require('mssql');

// // 2 weeks in milliseconds
// // const INACTIVE_THRESHOLD = 1209600000;
// const INACTIVE_THRESHOLD = 50000;

// module.exports = async function (ws, actionData) {
//     let connection;
//     let transaction;

//     try {
//         connection = await poolPromise;
//         transaction = new sql.Transaction(connection);
//         await transaction.begin();
//         const request = new sql.Request(transaction);
//         // Get all UserID's from Logins where LastSeen < Date.now() - INACTIVE_THRESHOLD and FLAGS includes guest flag

//         let oldAccQuery = await request.query(`
//             SELECT UserID FROM Logins WHERE IsGuest = 1 AND LastSeen < ${Date.now() - INACTIVE_THRESHOLD}
//         `)

//         let toPurge = oldAccQuery.recordset;


//         if (toPurge.length === 0) {
//             ws.send(JSON.stringify( {
//                 status: 200,
//                 body: {
//                     message: "no accounts valid for deletion"
//                 }
//             }));
//             return;
//         }
//         // Create the (x,y,z) string
//         let allIdsString = `(`;
//         for (let i = 0; i < toPurge.length; ++i) {
//             allIdsString = allIdsString.concat(`${toPurge[i].UserID},`)
//         }
//         allIdsString = allIdsString.substring(0, allIdsString.length - 1);
//         allIdsString = allIdsString.concat(')')


//         // DELETE FROM [YourTable] WHERE UserID IN (x, y, z, ...); with the (x,y,z) being allIdsString
//         let delLogins = await request.query(`DELETE FROM Logins WHERE UserID in ${allIdsString}`);
//         let delAM = await request.query(`DELETE FROM AnimalManagement WHERE UserID in ${allIdsString}`);
//         let delAnimals = await request.query(`DELETE FROM Animals WHERE UserID in ${allIdsString}`);
//         let delCropTiles = await request.query(`DELETE FROM CropTiles WHERE UserID in ${allIdsString}`);
//         let delProfile = await request.query(`DELETE FROM Profiles WHERE UserID in ${allIdsString}`);
//         let delUpgrades = await request.query(`DELETE FROM Upgrades WHERE UserID in ${allIdsString}`);
//         let delIS = await request.query(`DELETE FROM Inventory_SEEDS WHERE UserID in ${allIdsString}`);
//         let delIP = await request.query(`DELETE FROM Inventory_PRODUCE WHERE UserID in ${allIdsString}`);
//         let delTL = await request.query(`DELETE FROM TempLeaderboard WHERE UserID in ${allIdsString}`);
//         let delTLS = await request.query(`DELETE FROM TempLeaderboardSum WHERE UserID in ${allIdsString}`);
//         let delL = await request.query(`DELETE FROM Leaderboard WHERE UserID in ${allIdsString}`);
//         let delLS = await request.query(`DELETE FROM LeaderboardSum WHERE UserID in ${allIdsString}`);
//         let delOrders = await request.query(`DELETE FROM ORDERS WHERE UserID in ${allIdsString}`);

//         console.log(delOrders)

//         if (delLogins.rowsAffected[0] === 0 || delAM.rowsAffected[0] === 0 || delAnimals.rowsAffected[0] === 0 || delCropTiles.rowsAffected[0] === 0 || delProfile.rowsAffected[0] === 0 ||
//             delUpgrades.rowsAffected[0] === 0 || delIS.rowsAffected[0] === 0 || delIP.rowsAffected[0] === 0 || delTL.rowsAffected[0] === 0 || delTLS.rowsAffected[0] === 0 ||
//             delL.rowsAffected[0] === 0 || delLS.rowsAffected[0] === 0 || delOrders.rowsAffected[0] === 0) {
//             console.log("FAILED TO UPDATE ALL TABLES");
//             await transaction.rollback();
//         }

//         ws.send(JSON.stringify( {
//             status: 200,
//             body: {
//                 message: 'account purge successful',
//                 count: delLogins.rowsAffected[0]
//             }
//         }));
//         await transaction.commit();
//     } catch (error) {
//         console.log(error)
//         ws.send(JSON.stringify( {
//             status: 500,
//             body: {
//                 message: 'error in purging accounts'
//             }
//         }));
//         await transaction.rollback();
//     }


   
// }





