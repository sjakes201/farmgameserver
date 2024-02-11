const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const sql = require('mssql');
const { poolPromise } = require('../../db');
const reportInvalidAction = require('../../serverActions/reportInvalidAction/index.js');

// returns array of updated tiles
module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    // usi is user scripting info, p is page
    let page = actionData?.usi?.p;
    let validActionPage = page === "/" || page === "/plants"
    if(!validActionPage) {
        reportInvalidAction(UserID, "wrongActionPage");
    }

    // tiles is array of objects with tileID and seedName [{tileID: 2}]
    let tiles = actionData.tiles, seed = actionData.seedName, cropID = CONSTANTS.ProduceIDs[seed];
    if (!(seed in UPGRADES.GrowthTimes0)) {
        console.log(`INVALID SEED ${seed}`);
        return {
            message: "INVALID SEED"
        };
    }

    if (tiles.length <= 0) {
        return {
            message: "Invalid tiles count"
        };
    }

    if(tiles.length > 9) {
        reportInvalidAction(UserID, "multiToolCount")
    }
    
    let connection;
    let transaction;

    try {
        connection = await poolPromise;

        // Get upgrades before transaction to get harvests info
        let upgradesQuery = await connection.query(`SELECT deluxePermit, plantNumHarvestsUpgrade FROM Upgrades WHERE UserID = ${UserID}`);

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID);
        request.input('date', sql.Decimal, Date.now() - 500);

        let updateTilesQuery = ``;

        let tileQuery = `SELECT * FROM CropTiles WHERE UserID = @UserID AND (`
        tiles.forEach((tile) => {
            let thisID = tile.tileID;
            if (Number.isInteger(thisID) || thisID >= 1 || thisID <= 60) {
                tileQuery += `TileID = ${thisID} OR `
            }
        })
        tileQuery = tileQuery.substring(0, tileQuery.length - 4);
        tileQuery += `)`
        let dbTiles = await request.query(tileQuery);
        let plantableCount = 0;
        let tilesToReturn = [];
        dbTiles.recordset.forEach((dbTile) => {
            if (dbTile.CropID === -1) {
                plantableCount++;
                let activeHarvestFert = dbTile.HarvestsFertilizer > 0;
                let levelUpgrade = upgradesQuery.recordset[0].plantNumHarvestsUpgrade;
                let harvestsTable = "NumHarvests".concat(levelUpgrade);
                if (activeHarvestFert) {
                    updateTilesQuery += `
                    UPDATE CropTiles SET CropID = ${cropID}, PlantTime = @date, HarvestsRemaining = ${UPGRADES[harvestsTable][seed] + 1}, HarvestsFertilizer = HarvestsFertilizer - 1 WHERE UserID = @UserID AND TileID = ${dbTile.TileID}
                    `
                } else {
                    updateTilesQuery += `
                    UPDATE CropTiles SET CropID = ${cropID}, PlantTime = @date, HarvestsRemaining = ${UPGRADES[harvestsTable][seed]} WHERE UserID = @UserID AND TileID = ${dbTile.TileID}
                    `
                }
                tilesToReturn.push({
                    TileID: dbTile.TileID,
                    CropID: cropID,
                    PlantTime: Date.now() - 500
                })
            }
        })
        let tilesResult = await request.query(updateTilesQuery);
        let seedQuery = await request.query(`
            UPDATE Inventory_SEEDS SET ${seed} = ${seed} - ${plantableCount} WHERE UserID = @UserID
            SELECT ${seed} FROM Inventory_SEEDS WHERE UserID = @UserID
        `)
        if (seedQuery.recordset[0][seed] < 0) {
            await transaction.rollback();
            return {
                message: 'Insufficient seed count in inventory'
            };
        }

        await transaction.commit();
        return {
            message: "SUCCESS",
            updatedTiles: tilesToReturn
        };

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        if (error.includes("Invalid tileid")) {
            return {
                message: `Invalid tile id`
            }
        } else {
            return {
                message: 'Uncaught error'
            }
        }
    }

}





