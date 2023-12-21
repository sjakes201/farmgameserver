const sql = require('mssql');
const { poolPromise } = require('../../db');

const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const townGoalContribute = require(`../shared/townGoalContribute`);
const TOWNINFO = require('../shared/TOWNINFO');
const TOWNSHOP = require('../shared/TOWNSHOP')
const BOOSTSINFO = require('../shared/BOOSTSINFO')
const { calcProduceYield } = require('../shared/farmHelpers')

const getCurrentSeason = () => {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const nowMS = Date.now();
    let msPerDay = 24 * 60 * 60 * 1000;
    let daysPassed = Math.floor(nowMS / msPerDay)
    let seasonIndex = daysPassed % 4;
    return seasons[seasonIndex];
};

module.exports = async function (ws, actionData) {

    // GET REQ DATA
    let AnimalID = actionData?.AnimalID;
    // GET USER ID
    const UserID = ws.UserID;
    // Used later in townGoalContribute
    let resultingGood;
    let resultingQuantity;


    // COLLECT LOGIC
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
                TP.animalTimeLevel
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

            
            SELECT BT.BoostName, BT.Type, BT.BoostTarget
            FROM PlayerBoosts PB
                LEFT JOIN BoostTypes BT ON PB.BoostTypeID = BT.BoostTypeID
            WHERE UserID = @UserID AND (PB.StartTime + BT.Duration) > ${Date.now()}

        `);
        let townPerks = userQuery.recordsets[0][0]
        let upgrades = userQuery.recordsets[1][0]

        let townID = townPerks?.townID;

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
        let activeBoosts = boostsQuery.recordset;
        // Begin transaction
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('AnimalID', sql.Int, parseInt(AnimalID));

        // Get animal info (SQL +ANIMALS)
        let animalInfo = await request.query(`
        SELECT Animal_type, Last_produce, Next_random, Happiness 
        FROM Animals 
        WHERE UserID = @UserID AND Animal_ID = @AnimalID`)

        if ((animalInfo.recordset).length === 0) {
            await transaction.rollback();
            return {
                message: "ERROR Animal does not exist"
            };
        }

        let animalType = animalInfo.recordset[0].Animal_type;

        // Find out if animal is unlocked based on upgraeds
        if (CONSTANTS.Permits.exoticAnimals.includes(animalType) && !upgrades.exoticPermit) {
            await transaction.rollback();
            return {
                message: "NEED PERMIT"
            };
        }


        // Get time needed info based on upgrades
        let location = CONSTANTS.AnimalTypes[animalType][0]
        let collectUGLevel = 0;
        let quantityUGLevel = 0;
        switch (location) {
            case 'coop':
                collectUGLevel = upgrades.coopCollectTimeUpgrade;
                quantityUGLevel = upgrades.coopCollectQuantityUpgrade;
                break;
            case 'barn':
                collectUGLevel = upgrades.barnCollectTimeUpgrade;
                quantityUGLevel = upgrades.barnCollectQuantityUpgrade;
                break;
        }
        let collectTableName = "AnimalCollectTimes" + collectUGLevel;
        let quantityTableName = "AnimalProduceMap" + quantityUGLevel;

        // Check how much time has passed since last produce
        let last_produce = animalInfo.recordset[0].Last_produce;
        let timeNeeded = UPGRADES[collectTableName][animalType][0]

        const curTime = Date.now();
        let secsPassed = (curTime - last_produce) / 1000;
        // buffer for less 400's
        secsPassed += 0.50;

        if (townPerks?.animalTimeLevel > 0) {
            let boostPercent = TOWNSHOP.perkBoosts.animalTimeLevel[townPerks.animalTimeLevel - 1];
            let boostChange = 1 + boostPercent;
            secsPassed *= boostChange;
        }

        let inSeason = CONSTANTS.animalSeasons[getCurrentSeason()].includes(animalType);
        if (inSeason) {
            let boostPercent = CONSTANTS.VALUES.SEASON_ANIMAL_BUFF;
            let boostChange = 1 + boostPercent;
            secsPassed *= boostChange;
        }

        activeBoosts?.forEach(boost => {
            if (boost.Type === "TIME" && boost.BoostTarget === "ANIMALS") {
                let boostPercent = BOOSTSINFO[boost.BoostName].boostPercent;
                secsPassed *= 1 + boostPercent;
            } else if (boost.Type === "TIME" && boost.BoostTarget === animalType) {
                let boostName = boost.BoostName;
                let level = boostName[boostName.length - 1];
                let boostPercent = BOOSTSINFO?.[`ANIMAL_INDIV_TIME_${level}`]?.boostPercents[animalType];
                secsPassed *= 1 + boostPercent;
            }
        })

        if (secsPassed >= timeNeeded) {
            // Enough time has passed
            let happiness = animalInfo.recordset[0].Happiness, nextRandom = animalInfo.recordset[0].Next_random;
            let produce = UPGRADES[quantityTableName][animalType][0]

            let qty = calcProduceYield(animalType, quantityUGLevel, happiness, nextRandom, activeBoosts);

            request.input('curTime', sql.Decimal, curTime);
            request.input('xp', sql.Int, CONSTANTS.XP[produce])

            // Random probability of extra qty? At max happiness, 50% chance of extra produce

            // For town goals
            resultingGood = produce; resultingQuantity = qty;

            let newRandom = Math.round(Math.random() * 100) / 100;
            request.input('newRandom', sql.Float, newRandom)

            // If enough time has passed, update Last_produce and give yourself XP for collect (SQL -ANIMALS +PROFILES)
            let timeUpdate = await request.query(`
            UPDATE Animals SET Last_produce = @curTime, Next_random = @newRandom WHERE UserID = @UserID AND Animal_ID = @AnimalID
            SELECT * FROM ANIMALS WHERE UserID = @UserID AND Animal_ID = @AnimalID
            UPDATE Profiles SET XP = XP + @xp WHERE UserID = @UserID
            `)

            request.input('qty', sql.Int, qty);
            // Increment inventory for what we collected (SQL -PROFILES +INVENTORY_PRODUCE)
            let inventoryCount = await request.query(`UPDATE Inventory_PRODUCE SET ${produce} = ${produce} + @qty WHERE UserID = @UserID`);
            if (inventoryCount?.rowsAffected[0] !== 1) {
                await transaction.rollback();
                throw "Failed to update inventory collect count"
            }

            // Update leaderboards (SQL -INVENTORY_PRODUCE +TempLeaderboardSum +LeaderboardSum)
            let leaderboardUpdate = await request.query(`
            UPDATE TempLeaderboardSum set ${produce} = ${produce} + @qty WHERE UserID = @UserID
            UPDATE LeaderboardSum set ${produce} = ${produce} + @qty WHERE UserID = @UserID
            `)
            if (leaderboardUpdate.rowsAffected[0] === 0) {
                await transaction.rollback();
                return {
                    message: "Failed to update leaderboard"
                }
            }

            await transaction.commit();
            try {
                townGoalContribute(UserID, resultingGood, resultingQuantity);
            } catch (error) {
                console.log(error)
            }
            return {
                ...timeUpdate.recordset[0],
                wasReady: true,
                finishedOrder: false,
            };

        } else {
            // not enough time passed
            await transaction.rollback();
            return {
                ...animalInfo.recordset[0],
                wasReady: false,
                finishedOrder: false,
            };

        }

    } catch (error) {
        console.log(error)
        if (transaction) await transaction.rollback()
        console.log("Connection error in animal collect call")
        return {
            message: "Connection error in /collect call"
        };
    }


}





