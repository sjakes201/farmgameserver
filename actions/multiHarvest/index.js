const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const CROPINFO = require('../shared/CROPINFO')
const MACHINESINFO = require('../shared/MACHINESINFO')
const TOWNINFO = require('../shared/TOWNINFO')
const TOWNSHOP = require('../shared/TOWNSHOP')
const sql = require('mssql');
const { poolPromise } = require('../../db');
const BOOSTSINFO = require('../shared/BOOSTSINFO')
const { calcCropYield } = require('../shared/farmHelpers')

const townGoalContribute = require(`../shared/townGoalContribute`);

const getCurrentSeason = () => {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const currentDateUTC = new Date(Date.now());
    currentDateUTC.setMinutes(currentDateUTC.getMinutes() + currentDateUTC.getTimezoneOffset());

    const epochStart = new Date(Date.UTC(1970, 0, 1));
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    let totalDays = Math.floor((currentDateUTC - epochStart) / millisecondsPerDay);
    const currentSeasonIndex = totalDays % seasons.length;

    return seasons[currentSeasonIndex];
};

const getGrowthTime = (growthTableName, cropID) => {
    let secsNeeded = (UPGRADES[growthTableName][CONSTANTS.ProduceNameFromID[cropID]]).reduce((prev, sum) => sum + prev);
    return secsNeeded
}

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    // Multitile input: receive an array of objects, one object per tile, each tile has tileID: which is the tile id [{tileID: 2}, {tileID: 4}, {tileID: 5}]
    const tiles = actionData.tiles;
    if (tiles.length <= 0) {
        return {
            message: "Invalid multiHarvest tiles count"
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
        let preRequest = new sql.Request(connection)
        preRequest.input(`UserID`, sql.Int, UserID);
        let userQuery = await preRequest.query(`
        UPDATE Logins SET LastSeen = ${Date.now()} WHERE UserID = @UserID
        SELECT 
            TM.townID, 
            TP.cropTimeLevel, 
            TP.partsChanceLevel
        FROM 
            TownMembers TM
        INNER JOIN 
            TownPurchases TP ON TP.townID = TM.townID
        WHERE 
            TM.UserID = @UserID;

        SELECT * 
        FROM 
            Upgrades 
        WHERE 
            UserID = @UserID;

        `);
        let townPerks = userQuery.recordsets[0][0];
        let upgrades = userQuery.recordsets[1][0];
        let townID = userQuery.recordsets[0]?.[0]?.townID;

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

        let boostsQuery = await preRequest.query(`
            SELECT BT.BoostName, BT.Type, BT.BoostTarget, PB.BoostID
            FROM PlayerBoosts PB
            LEFT JOIN BoostTypes BT ON PB.BoostTypeID = BT.BoostTypeID
            WHERE PB.UserID = @UserID AND (PB.StartTime + BT.Duration) > ${Date.now()} AND PB.Activated = 1
            
            ${townID ? `
            UNION
            
            SELECT BT.BoostName, BT.Type, BT.BoostTarget, TB.BoostID
            FROM TownBoosts TB
            LEFT JOIN BoostTypes BT ON TB.BoostTypeID = BT.BoostTypeID
            WHERE TB.townID = ${townID} AND (TB.StartTime + BT.Duration) > ${Date.now()}
            ` : ''}        
        `)

        let activeBoosts = []
        boostsQuery.recordset?.forEach(boost => {
            activeBoosts.push({
                BoostName: boost.BoostName,
                Type: boost.Type,
                BoostTarget: boost.BoostTarget
            })
        })

        tilesToCheck.forEach((tile) => {
            let updatedTile = {
                TileID: tile.TileID,
                CropID: -1,
                PlantTime: null
            };
            let nextRandom = tile.nextRandom;
            const newRandom = (Math.floor(Math.random() * 99) + 1) / 100;

            let plantTime = tile.PlantTime;
            let secsPassed = (curTime - plantTime) / (1000);
            // buffer for less 400's
            secsPassed += 0.5;

            let cropID = tile.CropID;

            let secsNeeded = getGrowthTime(growthTableName, cropID);
            activeBoosts?.forEach(boost => {
                if (boost.Type === "TIME" && boost.BoostTarget === "CROPS") {
                    let boostPercent = BOOSTSINFO[boost.BoostName].boostPercent;
                    secsPassed *= 1 + boostPercent;
                } else if (boost.Type === "TIME" && boost.BoostTarget === CONSTANTS.ProduceNameFromID[cropID]) {
                    let boostName = boost.BoostName;
                    let level = boostName[boostName.length - 1];
                    let boostPercent = BOOSTSINFO?.[`CROP_INDIV_TIME_${level}`]?.boostPercents[CONSTANTS.ProduceNameFromID[cropID]];
                    secsPassed *= 1 + boostPercent;
                }
            })

            let activeFertilizer = false;
            let timeFertRemainingSecs = -1;
            // check if fertilized
            if (tile.TimeFertilizer !== -1) {
                // if fertilizer exists
                secsPassed *= 2;
                let fertilizedTime = tile.TimeFertilizer;
                if (curTime - fertilizedTime < CONSTANTS.VALUES.TimeFeritilizeDuration) {
                    // fertilizer did not expire
                    activeFertilizer = true;
                }
                timeFertRemainingSecs = (CONSTANTS.VALUES.TimeFeritilizeDuration - (curTime - fertilizedTime)) / 1000
            }

            if (townPerks?.cropTimeLevel > 0) {
                let boostPercent = TOWNSHOP.perkBoosts.cropTimeLevel[townPerks.cropTimeLevel - 1];
                let boostChange = 1 + boostPercent;
                secsPassed *= boostChange;
            }

            let seedName = CONSTANTS.ProduceNameFromID[cropID];
            if (CONSTANTS?.cropSeasons?.[getCurrentSeason()]?.includes(seedName)) {
                let boostPercent = CONSTANTS.VALUES.SEASON_GROWTH_BUFF;
                secsPassed *= (1 + boostPercent);
            }

            if (secsPassed >= secsNeeded) {
                // decrease RemainingHarvests, if 0, clear tile, else, set to beginning of last growth stage (only has to do last growth time again)

                let crop_name = CONSTANTS.SeedCropMap[CONSTANTS.ProduceNameFromID[cropID]][0];
                // if we have a yields fertilizer, increment crop_qty then also decrement in croptiles update
                let activeYieldsFert = tile.YieldsFertilizer > 0;

                let crop_qty = calcCropYield(nextRandom, seedName, upgrades.plantHarvestQuantityUpgrade, activeYieldsFert, activeBoosts)

                // increment XP sum and crops sum
                xpSum += CONSTANTS.XP[crop_name]

                cropsSum[crop_name] = (cropsSum[crop_name] || 0) + crop_qty;

                let remaining_harvests = tile.HarvestsRemaining;
                if (remaining_harvests - 1 <= 0) {
                    // no more harvests or was single harvest
                    if (activeYieldsFert) {
                        updateCropTilesQuery += `
                         UPDATE CropTiles set 
                         CropID = -1, 
                         PlantTime = NULL, 
                         YieldsFertilizer = YieldsFertilizer - 1, 
                         HarvestsRemaining = NULL,
                         nextRandom = ${newRandom}
                         WHERE UserID = @UserID AND TileID = ${tile.TileID} 
                        `
                    } else {
                        updateCropTilesQuery += `
                        UPDATE CropTiles set 
                            CropID = -1, 
                            PlantTime = NULL, 
                            HarvestsRemaining = NULL,
                            nextRandom = ${newRandom}
                        WHERE UserID = @UserID AND TileID = ${tile.TileID}
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

                    activeBoosts?.forEach(boost => {
                        if (boost.Type === "TIME" && boost.BoostTarget === "CROPS") {
                            let boostPercent = BOOSTSINFO[boost.BoostName].boostPercent;
                            timeSkip /= (1 + boostPercent);
                        }
                    })

                    if (townPerks?.cropTimeLevel > 0) {
                        let boostPercent = TOWNSHOP.perkBoosts.cropTimeLevel[townPerks.cropTimeLevel - 1];
                        let boostChange = 1 + boostPercent;
                        timeSkip /= boostChange;
                    }

                    if (CONSTANTS?.cropSeasons?.[getCurrentSeason()]?.includes(seedName)) {
                        let boostPercent = CONSTANTS.VALUES.SEASON_GROWTH_BUFF;
                        timeSkip /= (1 + boostPercent);
                    }

                    let adjustedPlantTime = Date.now() - timeSkip - 200;

                    if (!activeFertilizer) {
                        // remove fertilizer for future harvests
                        if (activeYieldsFert) {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set
                                    HarvestsRemaining = HarvestsRemaining - 1,
                                    PlantTime = ${adjustedPlantTime}, 
                                    TimeFertilizer = -1,
                                    YieldsFertilizer = YieldsFertilizer - 1,
                                    nextRandom = ${newRandom}
                                WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        } else {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set 
                                    HarvestsRemaining = HarvestsRemaining - 1, 
                                    PlantTime = ${adjustedPlantTime}, 
                                    TimeFertilizer = -1,
                                    nextRandom = ${newRandom}
                                WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        }
                    } else {
                        if (activeYieldsFert) {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set
                                    HarvestsRemaining = HarvestsRemaining - 1,
                                    PlantTime = ${adjustedPlantTime}, 
                                    YieldsFertilizer = YieldsFertilizer -1,
                                    nextRandom = ${newRandom}
                                WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        } else {
                            updateCropTilesQuery += `
                                UPDATE CropTiles set
                                    HarvestsRemaining = HarvestsRemaining - 1,
                                    PlantTime = ${adjustedPlantTime},
                                    nextRandom = ${newRandom}
                                WHERE UserID = @UserID AND TileID = ${tile.TileID}
                           `

                        }

                    }

                    updatedTile = {
                        TileID: tile.TileID,
                        CropID: cropID,
                        PlantTime: adjustedPlantTime
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

                if (townPerks?.partsChanceLevel > 0) {
                    let boostPercent = TOWNSHOP.perkBoosts.partsChanceLevel[townPerks.partsChanceLevel - 1];
                    let boostChange = 1 + boostPercent;
                    chance *= boostChange;
                }

                if (getCurrentSeason() === 'winter') {
                    chance *= 1 + CONSTANTS.VALUES.WINTER_PARTS_BUFF
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
                    timeFertRemainingSecs: timeFertRemainingSecs,
                    nextRandom: newRandom
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
            finishedOrder: false,
        }

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "/multiHarvest error"
        }
    }
}





