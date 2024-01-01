const YIELDS = require("./YIELDS")
const BOOSTSINFO = require("./BOOSTSINFO")
const CONSTANTS = require("./CONSTANTS")

const getCurrentSeason = () => {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const nowMS = Date.now();
    let msPerDay = 24 * 60 * 60 * 1000;
    let daysPassed = Math.floor(nowMS / msPerDay)
    let seasonIndex = daysPassed % 4;
    return seasons[seasonIndex];
};

function calcCropYield(nextRandom, seedName, yieldsUpgradeTier, yieldsFertilizer, activeBoosts) {
    if (!(typeof nextRandom === "number" && !isNaN(nextRandom) && nextRandom >= 0 && nextRandom <= 1)) throw new Error("nextRandom must be a decimal number in [0, 1]")
    if (!(typeof seedName === "string" && seedName in YIELDS.cropProbabilities.yieldsUpgradeTier0)) throw new Error("seedName must be an existing seed name as a string")
    if (!(typeof yieldsUpgradeTier === "number" && yieldsUpgradeTier >= 0 && yieldsUpgradeTier <= 4)) throw new Error("yieldsUpgradeTier must be an integer in [0, 4]")
    if (!(typeof yieldsFertilizer === "boolean")) throw new Error("yieldsFertilizer must be a boolean")
    if (!(Array.isArray(activeBoosts))) throw new Error("activeBoosts must be an array of boost objects")

    let roll = nextRandom;
    let yieldQty = 0;
    const probabilities = YIELDS.cropProbabilities[`yieldsUpgradeTier${yieldsUpgradeTier}`][seedName]

    // Add to roll based on yields fertilizer (luck factor)
    if (yieldsFertilizer) {
        roll += YIELDS.luckFactors.yieldsFertilizer
    }

    // Add to yields based on QTY boosts (final yields factor)
    activeBoosts?.forEach(boost => {
        if (boost.Type === 'QTY' && boost.BoostTarget === "CROPS") {
            let qtyIncrease = BOOSTSINFO[boost.BoostName]?.boostQtys?.[seedName];
            yieldQty += qtyIncrease;

        } else if (boost.Type === 'QTY' && boost.BoostTarget === seedName) {
            let boostName = boost.BoostName;
            let level = boostName[boostName.length - 1];
            const qtyIncrease = BOOSTSINFO?.[`CROP_INDIV_${level}`]?.boostQtys?.[seedName];
            yieldQty += qtyIncrease
        }
    })

    // Get yield based on roll (any luck boosts already applied)
    for (let i = 1; i <= probabilities.length; i++) {
        roll -= probabilities[i - 1];
        if (roll > 0) {
            if (i === probabilities.length) yieldQty += i;
            continue
        } else {
            yieldQty += i;
            break;
        }
    }
    return yieldQty
}

function calcProduceYield(animalType, yieldsUpgradeTier, happiness, nextRandom, activeBoosts) {
    if (!(typeof nextRandom === "number" && !isNaN(nextRandom) && nextRandom >= 0 && nextRandom <= 1)) throw new Error("nextRandom must be a decimal number in [0, 1]")
    if (!(typeof animalType === "string" && animalType in YIELDS.produceProbabilities.yieldsUpgradeTier0)) throw new Error("animalType must be an existing seed name as a string")
    if (!(typeof yieldsUpgradeTier === "number" && yieldsUpgradeTier >= 0 && yieldsUpgradeTier <= 4)) throw new Error("yieldsUpgradeTier must be an integer in [0, 4]")
    if (!(typeof happiness === "number" && !isNaN(happiness))) throw new Error("happiness must be a decimal number")
    if (!(Array.isArray(activeBoosts))) throw new Error("activeBoosts must be an array of boost objects")

    let roll = nextRandom;
    let yieldQty = 0;
    const probabilities = YIELDS.produceProbabilities[`yieldsUpgradeTier${yieldsUpgradeTier}`][animalType]

    // Add to roll based on happiness (luck factor)
    if (happiness > 1) happiness = 1;
    roll += (happiness / 3)
    
    let inSeason = CONSTANTS.animalSeasons[getCurrentSeason()].includes(animalType);
    if(inSeason) roll += 0.1;

    // Add to yields based on QTY boosts (final yields factor)
    activeBoosts?.forEach(boost => {
        if (boost.Type === 'QTY' && boost.BoostTarget === 'ANIMALS') {
            let qtyIncrease = BOOSTSINFO[boost.BoostName].boostQtys[animalType]
            yieldQty += qtyIncrease;
        } else if (boost.Type === 'QTY' && boost.BoostTarget === animalType) {
            let boostName = boost.BoostName;
            let level = boostName[boostName.length - 1];
            const qtyIncrease = BOOSTSINFO?.[`ANIMAL_INDIV_${level}`]?.boostQtys?.[animalType];
            yieldQty += qtyIncrease;
        }
    })

    for (let i = 1; i <= probabilities.length; i++) {
        roll -= probabilities[i - 1];
        if (roll > 0) {
            if (i === probabilities.length) yieldQty += i;
            continue
        } else {
            yieldQty += i;
            break;
        }
    }

    return yieldQty;
}


module.exports = {
    calcCropYield,
    calcProduceYield
}