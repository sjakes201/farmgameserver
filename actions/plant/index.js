const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const sql = require('mssql');
const { poolPromise } = require('../../db');



module.exports = async function (ws, actionData) {

    // GET USERID
    const UserID = ws.UserID;

    // CHECK INPUTS    

    let seed = actionData.seedName, cropID = CONSTANTS.ProduceIDs[seed], tileID = actionData.tileID;

    // verify seed is valid sql column
    if (!(seed in UPGRADES.GrowthTimes0)) {
        console.log(`INVALID SEED ${seed}`);
        return {
            message: "INVALID SEED"
        };
    }

    let connection;
    let transaction;
    try {
        // check if tile is empty
        let updatedTile = {
            TileID: tileID,
            CropID: -1,
            PlantTime: null
        }
        connection = await poolPromise;

        // Get upgrades before transaction to get harvests info
        let upgradesQuery = await connection.query(`SELECT deluxePermit, plantNumHarvestsUpgrade FROM Upgrades WHERE UserID = ${UserID}`);

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('UserID', sql.Int, UserID);
        request.input('tileID', sql.Int, tileID);

        // Get relevant tile (SQL +CropTiles)
        let tilecontents = await request.query(`SELECT * FROM CropTiles WHERE UserID = @UserID AND TileID = @tileID`);

        let activeHarvestFert = tilecontents.recordset[0].HarvestsFertilizer > 0;

        if (tilecontents.recordset[0].CropID === -1) {
            // tile is empty, check if they need a permit and have


            // tile is empty and can be planted in

            let levelUpgrade = upgradesQuery.recordset[0].plantNumHarvestsUpgrade;
            let harvestsTable = "NumHarvests".concat(levelUpgrade);

            let nowInMS = Date.now();
            request.input('date', sql.Decimal, nowInMS - 500);
            let plantQuery;
            if (activeHarvestFert) { //increase harvests by 1 due to fertilizer and dec fert count
                request.input('totalHarvests', sql.Int, UPGRADES[harvestsTable][seed] + 1)
                plantQuery = await request.query(`
                UPDATE CropTiles SET CropID = ${cropID}, PlantTime = @date, HarvestsRemaining = @totalHarvests, HarvestsFertilizer = HarvestsFertilizer - 1 WHERE UserID = @UserID AND TileID = @tileID
                SELECT PlantTime FROM CropTiles WHERE UserID = @UserID AND TileID = @tileID
            `)
            } else { // no fertilizer
                request.input('totalHarvests', sql.Int, UPGRADES[harvestsTable][seed])
                plantQuery = await request.query(`
                UPDATE CropTiles SET CropID = ${cropID}, PlantTime = @date, HarvestsRemaining = @totalHarvests WHERE UserID = @UserID AND TileID = @tileID
                SELECT PlantTime FROM CropTiles WHERE UserID = @UserID AND TileID = @tileID
            `)
            }


            // Check if we have the seed to do it (SQL -CropTiles +Inventory_SEEDS)
            let hasSeed = await request.query(`
                UPDATE Inventory_SEEDS SET ${seed} = ${seed} - 1 WHERE UserID = @UserID
                SELECT ${seed} FROM Inventory_SEEDS WHERE UserID = @UserID
            `);
            if (hasSeed.recordset[0][seed] < 0) {
                await transaction.rollback();
                updatedTile = {
                    TileID: tileID,
                    CropID: -1,
                    PlantTime: null
                }

                return {
                    message: "NOT IN INVENTORY",
                    ...updatedTile
                };
            }

            await transaction.commit();
            updatedTile = {
                TileID: tileID,
                CropID: cropID,
                PlantTime: plantQuery.recordset[0].PlantTime
            }
            return {
                message: "SUCCESS",
                ...updatedTile
            };
        } else {
            updatedTile = {
                TileID: tileID,
                CropID: tilecontents.recordset[0].CropID,
                PlantTime: tilecontents.recordset[0].PlantTime
            }
            await transaction.rollback();
            return {
                message: "TILE ALREADY PLANTED",
                ...updatedTile
            };
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: 'Uncaught error'
        }
    }
}





