const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const MACHINESINFO = require('../shared/MACHINESINFO')
const sql = require('mssql');
const { poolPromise } = require('../../db');
const townGoalContribute = require(`../shared/townGoalContribute`);
const TOWNINFO = require('../shared/TOWNINFO');
const TOWNSHOP = require('../shared/TOWNSHOP')

module.exports = async function (ws, actionData) {
    // GET USERID
    const UserID = ws.UserID;

    // Used later in townGoalContribute
    let resultingGood;
    let resultingQuantity;

    // GET INPUTS    
    const tileID = actionData.tileID;


    // DB LOGIC
    let connection;
    let transaction;
    try {
        //updatedTile is sent back to frontend to sync, this is starter template
        let updatedTile = {
            TileID: tileID,
            CropID: -1,
            PlantTime: null
        };

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

            -- Query for upgrades associated with the user
            SELECT * 
            FROM 
                Upgrades 
            WHERE 
                UserID = @UserID;
        `);

        let townPerks = userQuery.recordsets[0][0]
        let upgrades = userQuery.recordsets[1][0]

        transaction = new sql.Transaction(connection);
        await transaction.begin();

        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('tileID', sql.Int, tileID);


        // Get tile contents (SQL +CropTiles)
        let tilecontents = await request.query(`SELECT * FROM CropTiles WHERE UserID = @UserID AND TileID = @tileID`);

        if (tilecontents.recordset[0].CropID === -1) {
            await transaction.rollback();
            return {
                message: "NOTHING PLANTED",
                ...updatedTile
            };
        }


        // Calclate time needed
        let growthTableName = "GrowthTimes".concat(upgrades.plantGrowthTimeUpgrade);
        let quantityTableName = "PlantQuantityYields".concat(upgrades.plantHarvestQuantityUpgrade);

        let sqlTime = tilecontents.recordset[0].PlantTime;
        let curTime = Date.now();

        let secsPassed = (curTime - sqlTime) / (1000);
        // buffer for less 400's
        secsPassed += 0.5;

        let cropID = tilecontents.recordset[0].CropID;
        let secsNeeded = (UPGRADES[growthTableName][CONSTANTS.ProduceNameFromID[cropID]]).reduce((prev, sum) => sum + prev);
        // Reduce secsNeeded based on town's growthPerkLevel
        if (townPerks?.cropTimeLevel > 0) {
            let boostPercent = TOWNSHOP.perkBoosts.cropTimeLevel[townPerks.cropTimeLevel - 1];
            let boostChange = 1 - boostPercent;
            secsNeeded *= boostChange;
        }

        // If a crop ends it's time fertilized period, instead of going backwards in progress, it will have one remaining harvest be bonus time, then set time fertilizer to -1
        let activeFertilizer = false;
        let timeFertRemainingSecs = -1;
        // check if fertilized
        if (tilecontents.recordset[0].TimeFertilizer !== -1) {
            // if fertilizer exists
            secsNeeded /= 2;
            let fertilizedTime = tilecontents.recordset[0].TimeFertilizer;
            if (curTime - fertilizedTime < CONSTANTS.VALUES.TimeFeritilizeDuration) {
                // fertilizer did not expire
                activeFertilizer = true;
            }
            timeFertRemainingSecs = (CONSTANTS.VALUES.TimeFeritilizeDuration - (curTime - fertilizedTime)) / 1000
        }
        if (secsPassed >= secsNeeded) {
            // decrease RemainingHarvests, if 0, clear tile, else, set to beginning of last growth stage (only has to do last growth time again)

            let crop_name = CONSTANTS.SeedCropMap[CONSTANTS.ProduceNameFromID[cropID]][0];
            resultingGood = crop_name;
            let crop_qty = UPGRADES[quantityTableName][CONSTANTS.ProduceNameFromID[cropID]]
            // if we have a yields fertilizer, increment crop_qty then also decrement in croptiles update
            let activeYieldsFert = false;
            activeYieldsFert = tilecontents.recordset[0].YieldsFertilizer > 0;

            if (activeYieldsFert) {
                let bonus = CONSTANTS.yieldFertilizerBonuses[CONSTANTS.ProduceNameFromID[cropID]]
                request.input('crop_qty', sql.Int, crop_qty + bonus);
                resultingQuantity = crop_qty + bonus;

            } else {
                request.input('crop_qty', sql.Int, crop_qty);
                resultingQuantity = crop_qty;

            }
            request.input('xp', sql.Int, CONSTANTS.XP[crop_name]);

            let remaining_harvests = (tilecontents.recordset[0].HarvestsRemaining);
            if (remaining_harvests - 1 <= 0) {
                // no more harvests or was single harvest
                if (activeYieldsFert) {
                    await request.query(`
                    UPDATE CropTiles set CropID = -1, PlantTime = NULL, YieldsFertilizer = YieldsFertilizer - 1, HarvestsRemaining = NULL WHERE UserID = @UserID AND TileID = @tileID
                    `);

                } else {
                    await request.query(`
                    UPDATE CropTiles set CropID = -1, PlantTime = NULL, HarvestsRemaining = NULL WHERE UserID = @UserID AND TileID = @tileID
                    `);

                }
                updatedTile = {
                    TileID: tileID,
                    CropID: -1,
                    PlantTime: null
                }
            } else {
                // decrement remaining harvests
                // PlantTime is set to (now) - (sum of all growth stages except last), as it only has one last stage to do again
                let pnid = [null, "carrot_seeds", "melon_seeds", "cauliflower_seeds", "pumpkin_seeds", "yam_seeds",
                    "beet_seeds", "parsnip_seeds", "bamboo_seeds", "hops_seeds", "corn_seeds", "potato_seeds",
                    "blueberry_seeds", "grape_seeds", "oats_seeds", "strawberry_seeds"];
                let timeSkip = 0;
                for (i = 0; i < UPGRADES[growthTableName][pnid[cropID]].length - 1; ++i) {
                    timeSkip += UPGRADES[growthTableName][pnid[cropID]][i];
                }
                timeSkip *= 1000;
                //timeskip is milliseconds skip
                if (activeFertilizer) {
                    // active time fertilizer that has not expired
                    timeSkip /= 2;
                }
                if (townPerks?.cropTimeLevel > 0) {
                    let boostPercent = TOWNSHOP.perkBoosts.cropTimeLevel[townPerks.cropTimeLevel - 1];
                    let boostChange = 1 - boostPercent;
                    timeSkip *= boostChange;
                }
                let adjustedPlantTime = Date.now() - timeSkip - 200;
                request.input('adjustedPlantTime', sql.Decimal, adjustedPlantTime);
                let result;
                if (!activeFertilizer) {
                    // remove fertilizer for future harvests
                    if (activeYieldsFert) {
                        result = await request.query(`
                            UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = @adjustedPlantTime, TimeFertilizer = -1, YieldsFertilizer = YieldsFertilizer - 1 WHERE UserID = @UserID AND TileID = @tileID
                            SELECT PlantTime FROM CropTiles WHERE UserID = @UserID AND TileID=@tileID
                       `);

                    } else {
                        result = await request.query(`
                            UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = @adjustedPlantTime, TimeFertilizer = -1 WHERE UserID = @UserID AND TileID = @tileID
                            SELECT PlantTime FROM CropTiles WHERE UserID = @UserID AND TileID=@tileID
                       `);

                    }
                } else {
                    if (activeYieldsFert) {
                        result = await request.query(`
                            UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = @adjustedPlantTime, YieldsFertilizer = YieldsFertilizer -1 WHERE UserID = @UserID AND TileID = @tileID
                            SELECT PlantTime FROM CropTiles WHERE UserID = @UserID AND TileID=@tileID
                       `);

                    } else {
                        result = await request.query(`
                            UPDATE CropTiles set HarvestsRemaining = HarvestsRemaining - 1, PlantTime = @adjustedPlantTime WHERE UserID = @UserID AND TileID = @tileID
                            SELECT PlantTime FROM CropTiles WHERE UserID = @UserID AND TileID=@tileID
                       `);

                    }

                }

                updatedTile = {
                    TileID: tileID,
                    CropID: cropID,
                    PlantTime: adjustedPlantTime,
                }
            }


            // random chance of a machine part (SQL -LeaderboardSum +Inventory_PARTS)
            let randChance = parseFloat((Math.random() * (1.00 - 0.01) + 0.01).toFixed(2));
            let chance;
            let randomPart = null;
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
            }


            // increment XP (SQL -CropTiles +-Profiles +-Inventory_PARTS +-InventoryProduce +-TempLeaderboardSum +LeaderboardSum)
            await request.query(`
                UPDATE Profiles set XP = XP + @xp WHERE UserID = @UserID
                ${randomPart === null ? '' :
                    `UPDATE Inventory_PARTS SET ${randomPart} = ${randomPart} + 1 WHERE UserID = @UserID`}
                UPDATE Inventory_PRODUCE SET ${crop_name} = ${crop_name} + @crop_qty WHERE UserID = @UserID
                UPDATE TempLeaderboardSum set ${crop_name} = ${crop_name} + @crop_qty WHERE UserID = @UserID
                UPDATE LeaderboardSum set ${crop_name} = ${crop_name} + @crop_qty WHERE UserID = @UserID
            `)


            await transaction.commit();
            try {
                townGoalContribute(UserID, resultingGood, resultingQuantity);
            } catch (error) {
                console.log(error)
            }
            return {
                message: "SUCCESS",
                ...updatedTile,
                finishedOrder: false,
                randomPart: randomPart,
                hasTimeFertilizer: activeFertilizer,
            }
        } else {
            // not harvestable. return no
            updatedTile = {
                TileID: tileID,
                CropID: cropID,
                PlantTime: tilecontents.recordset[0].PlantTime,
                // HarvestsRemaining: tilecontents.recordset[0].HarvestsRemaining,
            }
            console.log("Not grown");
            await transaction.rollback();
            return {
                message: "NOT GROWN",
                ...updatedTile,
                hasTimeFertilizer: activeFertilizer,
                timeFertRemainingSecs: timeFertRemainingSecs,
            };
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: "/harvest error"
        }
    }
}





