const CONSTANTS = require('../../actions/shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db');

function getRandomElementsFromArray(arr, numElements) {
    const copyArr = [...arr];
    const result = [];

    numElements = Math.min(numElements, arr.length);

    // Fisher-Yates shuffle
    for (let i = copyArr.length - 1; i >= 0 && numElements > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [copyArr[i], copyArr[randomIndex]] = [copyArr[randomIndex], copyArr[i]];
        result.push(copyArr[i]);
        numElements--;
    }

    return result;
}

const getRandomBonus = () => {
    let randNum = Math.random();
    if (randNum > 0.8) {
        return 3
    } else {
        return 2
    }
}

module.exports = async function () {
    if(process.env.NODE_ENV === "TESTING") {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }


    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction)
        // Get current and clear previous 
        let curMultQuery = await request.query(`
        SELECT * FROM MARKET WHERE info = 'PRICE_MULTIPLIER'
        UPDATE MARKET SET 
            carrot = 1, melon = 1, cauliflower = 1, pumpkin = 1, yam = 1, beet = 1, parsnip = 1, bamboo = 1, hops = 1, corn = 1, potato = 1, blueberry = 1,
            grape = 1, oats = 1, strawberry = 1, chicken_egg = 1, cow_milk = 1, duck_egg = 1, quail_egg = 1, yak_milk = 1, sheep_wool = 1, goat_milk = 1,
            ostrich_egg = 1, llama_wool = 1, kiwi_egg = 1
        WHERE info = 'PRICE_MULTIPLIER'
        `);
        let currentMultiplier = curMultQuery.recordset[0]
        let allGoods = Object.keys(CONSTANTS.Init_Market_Prices)
        allGoods = allGoods.filter((good) => currentMultiplier[good] === 1)

        // Choose 1 (20%) or 2 (70%) or 3 (10%) random goods to bonus
        let randNum = Math.random();
        let numMultipliers = randNum < 0.20 ? 1 : randNum > 0.9 ? 3 : 2

        let newMultipliedGoods = getRandomElementsFromArray(allGoods, numMultipliers)

        let updateQuery = `UPDATE MARKET SET `
        for (let i = 0; i < newMultipliedGoods.length; ++i) {
            updateQuery += `${newMultipliedGoods[i]} = ${getRandomBonus()}`
            if (i + 1 < newMultipliedGoods.length) updateQuery += ', '
        }
        updateQuery += ` WHERE info = 'PRICE_MULTIPLIER'`
        await request.query(updateQuery)

        await transaction.commit()

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback();
    }
}





