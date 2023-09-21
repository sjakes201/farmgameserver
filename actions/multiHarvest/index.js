const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const CROPINFO = require('../shared/CROPINFO')
const MACHINESINFO = require('../shared/MACHINESINFO')
const TOWNINFO = require('../shared/TOWNINFO')
const sql = require('mssql');
const { poolPromise } = require('../../db');

const townGoalContribute = require(`../shared/townGoalContribute`);

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    // Multitile input: receive an array of objects, one object per tile, each tile has tileID: which is the tile id [{tileID: 2}, {tileID: 4}, {tileID: 5}]
    const tiles = actionData.tiles;
    // const tiles = [{ tileID: 1 }, { tileID: 2 }, { tileID: 3 }, { tileID: 11 }, { tileID: 21 }, { tileID: 31 }, { tileID: 41 }, { tileID: 51 }]
    if (tiles.length === 0 || tiles.length > 9) {
        return {
            message: "Invalid multiHarvest tiles count ([1,9] required)"
        };
    }
    /*
        Check whether user has this feature unlocked (maybe later also use for batching) and if they are within 9 tile limit
        Perform harvest operations on each
    */

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        let userQuery = await connection.query(`
        SELECT 
            P.townID, P.XP,
            T.growthPerkLevel, T.partsPerkLevel
        FROM 
            Profiles P
        INNER JOIN 
            Towns T ON P.townID = T.townID
        WHERE 
            P.UserID = ${UserID};
        SELECT * FROM Upgrades WHERE UserID = ${UserID}
        `);
        let upgrades = userQuery.recordsets[1][0]
        let townPerks = userQuery.recordsets[0][0]
        let userXP = userQuery.recordsets[0][0].XP;


        if (userXP < 0) {
            // TODO: set xp for level you unlock this feature, IF using only for multiharvest scythe
        }

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);

        let updatedTiles = [];

        // Create query with all tileID's as this is variable depending on what frontend sends (SQL +CropTiles)
        let tileQuery = `SELECT * FROM CropTiles WHERE UserID = @UserID AND (`
        tiles.forEach((tile, index) => {
            if (Number.isInteger(tile.tileID) && tile.tileID >= 1 && tile.tileID <= 60) {
                tileQuery += `TileID = ${tile.tileID}`
                if (index < tiles.length - 1) {
                    tileQuery += ` OR `
                }
            } else {
                throw `Invalid tile ${tile}`
            }
        })
        tileQuery += `)`
        let allTilesContent = await request.query(tileQuery);

        let tilesToCheck = allTilesContent.recordset.filter((tile) => tile.CropID !== -1);

        // check all tiles for whether they're done
        let growthTableName = "GrowthTimes".concat(upgrades.plantGrowthTimeUpgrade);
        let quantityTableName = "PlantQuantityYields".concat(upgrades.plantHarvestQuantityUpgrade);
        let curTime = Date.now();

        // SUMS AND QUERIES BUILD WHILE GOING OVER EACH TILE
        let updateCropTilesQuery = ``;
        let partsSum = {
            MetalSheets: 0,
            Bolts: 0,
            Gears: 0,
        }
        let cropsSum = {};
        let xpSum = 0;

        tilesToCheck.forEach((tile) => {
            let updatedTile = {
                TileID: tile.TileID,
                CropID: -1,
                PlantTime: null
            };
            let plantTime = tile.PlantTime;
            let secsPassed = (curTime - plantTime) / (1000);
            // buffer for less 400's
            secsPassed += 0.5;

            let cropID = tile.CropID;
            let secsNeeded = (UPGRADES[growthTableName][CONSTANTS.ProduceNameFromID[cropID]]).reduce((prev, sum) => sum + prev);

            let activeFertilizer = false;
            let timeFertRemainingSecs = -1;
            // check if fertilized
            if (tile.TimeFertilizer !== -1) {
                // if fertilizer exists
                secsNeeded /= 2;
                let fertilizedTime = tile.TimeFertilizer;
                if (curTime - fertilizedTime < CONSTANTS.VALUES.TimeFeritilizeDuration) {
                    // fertilizer did not expire
                    activeFertilizer = true;
                }
                timeFertRemainingSecs = (CONSTANTS.VALUES.TimeFeritilizeDuration - (curTime - fertilizedTime)) / 1000
            }
            if (townPerks?.growthPerkLevel) {
                let boostPercent = TOWNINFO.upgradeBoosts.growthPerkLevel[townPerks.growthPerkLevel];
                let boostChange = 1 - boostPercent;
                secsNeeded *= boostChange;
            }

            if (secsPassed >= secsNeeded) {
                // decrease RemainingHarvests, if 0, clear tile, else, set to beginning of last growth stage (only has to do last growth time again)

                let crop_name = CONSTANTS.SeedCropMap[CONSTANTS.ProduceNameFromID[cropID]][0];
                let crop_qty = UPGRADES[quantityTableName][CONSTANTS.ProduceNameFromID[cropID]]
                // if we have a yields fertilizer, increment crop_qty then also decrement in croptiles update
                let activeYieldsFert = tile.YieldsFertilizer > 0;

                if (activeYieldsFert) {
                    let bonus = CONSTANTS.yieldFertilizerBonuses[CONSTANTS.ProduceNameFromID[cropID]]
                    crop_qty = crop_qty + bonus;
                }
                // increment XP sum and crops sum
                xpSum += CONSTANTS.XP[crop_name]

                cropsSum[crop_name] = (cropsSum[crop_name] || 0) + crop_qty;

                let remaining_harvests = tile.HarvestsRemaining;
                if (remaining_harvests - 1 <= 0) {
                    // no more harvests or was single harvest
                    if (activeYieldsFert) {
                        updateCropTilesQuery += `
                         UPDATE CropTiles set CropID = -1, PlantTime = NULL, YieldsFertilizer = YieldsFertilizer - 1, HarvestsRemaining = NULL WHERE UserID = @UserID AND TileID = ${tile.TileID} 
                        `
                    } else {
                        updateCropTilesQuery += `
                        UPDATE CropTiles set CropID = -1, PlantTime = NULL, HarvestsRemaining = NULL WHERE UserID = @UserID AND TileID = ${tile.TileID}
                        `
                    }
                    updatedTile = {
                        TileID: tile.TileID,
                        CropID: -1,
                        PlantTime: null
                    }
                } else {
                    // decrement remaining harvests
                    // PlantTime is set to (now) - (sum of all growth stages except last), as it only has one last stage to do again
                    let seedsFromID = CROPINFO.seedsFromID;
                    let timeSkip = 0;
                    for (i = 0; i < UPGRADES[growthTableName][seedsFromID[cropID]].length - 1; ++i) {
                        timeSkip += UPGRADES[growthTableName][seedsFromID[cropID]][i];
                    }
                    timeSkip *= 1000;
                    //timeskip is milliseconds skip
                    if (activeFertilizer) {
                        // active time fertilizer that has not expired
                        timeSkip /= 2;
                    }

                    if (townPerks?.growthPerkLevel) {
                        let boostPercent = TOWNINFO.upgradeBoosts.growthPerkLevel[townPerks.growthPerkLevel];
                        let boostChange = 1 - boostPercent;
                        timeSkip *= boostChange;
                    }

                    let adjustedPlantTime = Date.now() - timeSkip - 200;

                    if (!activeFertilizer) {
                        // remove fertilizer for future harvests
                        if (activeYieldsFert) {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = ${adjustedPlantTime}, TimeFertilizer = -1, YieldsFertilizer = YieldsFertilizer - 1 WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        } else {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = ${adjustedPlantTime}, TimeFertilizer = -1 WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        }
                    } else {
                        if (activeYieldsFert) {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = ${adjustedPlantTime}, YieldsFertilizer = YieldsFertilizer -1 WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        } else {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = ${adjustedPlantTime} WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        }

                    }

                    updatedTile = {
                        TileID: tile.TileID,
                        CropID: cropID,
                        PlantTime: adjustedPlantTime,
                    }
                }

                let randChance = parseFloat((Math.random() * (1.00 - 0.01) + 0.01).toFixed(2));
                let chance;
                if (MACHINESINFO.partsChance.lowTier.includes(crop_name)) {
                    chance = 0.01;
                } else if (MACHINESINFO.partsChance.midTier.includes(crop_name)) {
                    chance = 0.02;
                } else if (MACHINESINFO.partsChance.highTier.includes(crop_name)) {
                    chance = 0.03;
                } else {
                    // missing in config
                    chance = 0.01;
                }
                if (townPerks?.partsPerkLevel) {
                    let boostPercent = TOWNINFO.upgradeBoosts.partsPerkLevel[townPerks.partsPerkLevel];
                    let boostChange = 1 + boostPercent;
                    chance *= boostChange;
                }
                let randomPart = null;
                if (randChance <= chance) {
                    // get a random machine part
                    let whichPartChance = Math.random();
                    if (whichPartChance < 0.33) {
                        randomPart = 'Bolts'
                    } else if (whichPartChance < 0.66) {
                        randomPart = 'MetalSheets'
                    } else {
                        randomPart = 'Gears';
                    }
                    partsSum[randomPart] += 1;
                }
                updatedTile = {
                    ...updatedTile,
                    randomPart: randomPart,
                    hasTimeFertilizer: activeFertilizer,
                    timeFertRemainingSecs: timeFertRemainingSecs
                }
                updatedTiles.push(updatedTile)

            }
        })
        if (xpSum === 0) {
            // xpSum is used to determine if any of the tiles were successfully harvested, else next sequence of queries will error
            await transaction.rollback();
            return {
                message: 'Nothing harvestable'
            };
        }

        // Execute CropTiles query
        await request.query(updateCropTilesQuery)
        // Build query for updating all those ^
        let finalQuery = `
        UPDATE Profiles SET XP = XP + ${xpSum} WHERE UserID = @UserID
        UPDATE Inventory_PARTS SET Bolts = Bolts + ${partsSum.Bolts}, Gears = Gears + ${partsSum.Gears}, MetalSheets = MetalSheets + ${partsSum.MetalSheets} WHERE UserID = @UserID 
        `
        let queryCropsSection = ``;
        for (const crop in cropsSum) {
            queryCropsSection += `${crop} = ${crop} + ${cropsSum[crop]},`
        }
        // remove final comma
        queryCropsSection = queryCropsSection.substring(0, queryCropsSection.length - 1);

        let produceQuery = `UPDATE Inventory_PRODUCE SET ${queryCropsSection} WHERE UserID = @UserID
        `
        let tempLeaderQuery = `UPDATE TempLeaderboardSum SET ${queryCropsSection} WHERE UserID = @UserID
        `
        let leaderQuery = `UPDATE LeaderboardSum SET ${queryCropsSection} WHERE UserID = @UserID
        `
        finalQuery += produceQuery;
        finalQuery += tempLeaderQuery;
        finalQuery += leaderQuery;
        await request.query(finalQuery)
        //Update orders

        // Update ORDERS if applicable (SQL -LeaderboardSum +ORDERS)
        let curOrders = await request.query(`SELECT goal_1, goal_2, goal_3, goal_4, progress_1, progress_2, progress_3, progress_4 FROM ORDERS WHERE UserID = @UserID`);
        let goal1 = curOrders.recordset[0].goal_1.split(" "), goal2 = curOrders.recordset[0].goal_2.split(" "), goal3 = curOrders.recordset[0].goal_3.split(" "), goal4 = curOrders.recordset[0].goal_4.split(" ");
        let progress1 = curOrders.recordset[0].progress_1, progress2 = curOrders.recordset[0].progress_2, progress3 = curOrders.recordset[0].progress_3, progress4 = curOrders.recordset[0].progress_4;
        let finishedOrder = false;

        let newProgress = {
            progress_1: 0,
            progress_2: 0,
            progress_3: 0,
            progress_4: 0
        }

        let amountToAdd;
        for (const good in cropsSum) {
            if (good === goal1[0]) {
                if (cropsSum[good] > 0) {
                    amountToAdd = cropsSum[good];
                    if (amountToAdd + progress1 >= parseInt(goal1[1])) {
                        amountToAdd = parseInt(goal1[1]) - progress1;
                        finishedOrder = true;
                    }
                    newProgress.progress_1 += amountToAdd
                    cropsSum[good] -= amountToAdd;
                    if (cropsSum[good] <= 0) {
                        break;
                    }
                }
            }
            if (good === goal2[0]) {
                if (cropsSum[good] > 0) {
                    amountToAdd = cropsSum[good];
                    if (amountToAdd + progress2 >= parseInt(goal2[1])) {
                        amountToAdd = parseInt(goal2[1]) - progress2;
                        finishedOrder = true;
                    }
                    newProgress.progress_2 += amountToAdd
                    cropsSum[good] -= amountToAdd;
                    if (cropsSum[good] <= 0) {
                        break;
                    }
                }

            }
            if (good === goal3[0]) {
                if (cropsSum[good] > 0) {
                    amountToAdd = cropsSum[good];
                    if (amountToAdd + progress3 >= parseInt(goal3[1])) {
                        amountToAdd = parseInt(goal3[1]) - progress3;
                        finishedOrder = true;
                    }
                    newProgress.progress_3 += amountToAdd
                    cropsSum[good] -= amountToAdd;
                    if (cropsSum[good] <= 0) {
                        break;
                    }
                }

            }
            if (good === goal4[0]) {
                if (cropsSum[good] > 0) {
                    amountToAdd = cropsSum[good];
                    if (amountToAdd + progress4 >= parseInt(goal4[1])) {
                        amountToAdd = parseInt(goal4[1]) - progress4;
                        finishedOrder = true;
                    }
                    newProgress.progress_4 += amountToAdd
                    cropsSum[good] -= amountToAdd;
                    if (cropsSum[good] <= 0) {
                        break;
                    }
                }

            }

        }
        if (newProgress.progress_1 > 0 || newProgress.progress_2 > 0 || newProgress.progress_3 > 0 || newProgress.progress_4 > 0) {
            await request.query(`
            UPDATE ORDERS SET progress_1 = progress_1 + ${newProgress.progress_1}, progress_2 = progress_2 + ${newProgress.progress_2}, progress_3 = progress_3 + ${newProgress.progress_3}, progress_4 = progress_4 + ${newProgress.progress_4} WHERE UserID = @UserID
            `)
        }


        await transaction.commit();
        Object.keys(cropsSum).forEach((crop) => {
            try {
                townGoalContribute(UserID, crop, cropsSum[crop])
            } catch (error) {
                console.log(error)
            }
        })
        return {
            message: "SUCCESS",
            updatedTiles: updatedTiles,
            finishedOrder: finishedOrder,
        }

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "/multiHarvest error"
        }
    }
}





