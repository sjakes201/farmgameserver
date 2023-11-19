const TOWNINFO = require('./TOWNINFO')
const CONSTANTS = require('./CONSTANTS')
const TOWNSHOP = require('./TOWNSHOP')
const { poolPromise } = require('../../db');
const sql = require('mssql');

// XP is integer
function calcTownLevel(XP) {
    if(!Number.isInteger(XP) || XP < 0) return 0;
    let thresholds = TOWNINFO.townLevels;
    let townLevel = 0;
    let remaining = XP;
    thresholds.forEach((threshold, index) => {
        if(remaining >= threshold) {
            remaining -= threshold;
            townLevel = index;
        }
    })
    // After reaching level 30 (final defined threshold) each level is just 30000 more 
    while(remaining >= 30000) {
        townLevel++;
        remaining -= 30000;
    }
    return townLevel;
}

function townPerkCost(perkName, level) {
    if(perkName in TOWNSHOP.perkCosts && level <= TOWNSHOP.perkCosts[perkName].length) {
        return TOWNSHOP.perkCosts[perkName][level - 1]
    } 
    return -1;
}

// townLevel is integer, perkName is string
function calcPerkLevels(townLevel) {
    if(!Number.isInteger(townLevel) || townLevel < 0) return 0;
    let perkLevels = TOWNINFO.townLevelForPerks;
    let result = {
        growthPerk: 0,
        partsPerk: 0,
        animalPerk: 0,
        orderRefreshPerk: 0
    }
    Object.keys(perkLevels).forEach((perk) => {
        let levelArr = perkLevels[perk];
        levelArr.forEach((lvlThreshold, index) => {
            if(townLevel >= lvlThreshold) result[perk] = index;
        })
    })

    return result;
}

function personalRewards(good, quantity) {
    if(!(good in CONSTANTS.Init_Market_Prices) || !Number.isInteger(quantity) || quantity < 0) return 0;
    let rewards = {
        gold: 0,
        xp: 0
    }
    // Gold is quantity / 15 * init market price if crop, or quantity * (2/3) * init market price if animal produce
    if(good.includes("_")) {
        //animal produce
        rewards.gold = Math.round((quantity * (2/3)) * CONSTANTS.Init_Market_Prices[good])
    } else {
        // crop
        rewards.gold = Math.round((quantity / 15) * CONSTANTS.Init_Market_Prices[good]);
    }
    // For now, personal XP is always 1000
    rewards.xp = 1000;


    return rewards;
}

function calcIndivRewards (good, quantity) {
    let rewards = {
        gold: 0,
        xp: 0
    }
    // Gold is quantity / 15 * init market price if crop, or quantity * (2/3) * init market price if animal produce
    if(good.includes("_")) {
        //animal produce
        rewards.gold = Math.round((quantity * (2/3)) * CONSTANTS.Init_Market_Prices[good])
    } else {
        // crop
        rewards.gold = Math.round((quantity / 15) * CONSTANTS.Init_Market_Prices[good]);
    }
    return rewards;
}

async function newIndividualGoal(currentGoals, allGoals) {
    if(!Array.isArray(allGoals) || allGoals.length === 0) {
        let connection = await poolPromise;
        allGoals = (await connection.query(`SELECT Good, Quantity, townFunds FROM IndivGoalGoodsQuantities`)).recordset
    }
    let allPossibleGoals = [...allGoals]
    let currentNumCrops = currentGoals.filter((goal) => !goal.Good.includes("_")).length;
    if(currentNumCrops < 5) {
        // Get rid of animal goals
        allPossibleGoals = allPossibleGoals.filter((goal) => !goal.Good.includes("_"))
    }
    if(currentNumCrops >= 7) {
        // Get rid of crop goals
        allPossibleGoals = allPossibleGoals.filter((goal) => goal.Good.includes("_"))
    }
    let randomIndex = Math.floor(Math.random() * allPossibleGoals.length);
    return allPossibleGoals[randomIndex];
}

// Returns array of 10 new goals for new towns
async function allNewIndividualGoals() {
    let connection = await poolPromise;
    let allPossible = (await connection.query(`SELECT Good, Quantity, townFunds FROM IndivGoalGoodsQuantities`)).recordset
    let newGoals = [];
    for(let i = 0; i < 12; ++i){
        newGoals.push(await newIndividualGoal(newGoals, allPossible))
    }
    return newGoals;
}

module.exports = { calcTownLevel, calcPerkLevels, personalRewards, townPerkCost, newIndividualGoal, allNewIndividualGoals, calcIndivRewards }