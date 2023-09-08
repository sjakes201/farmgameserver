const CONSTANTS = require('../shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function () {
    // if(process.env.NODE_ENV === "TESTING") {
    //     console.log("TESTING ENV, NOT RUNNING")
    //     return;
    // }

    
    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        // Before transaction
        let cur_price = await connection.query(`SELECT * FROM MARKET WHERE info = 'CUR_PRICE'`)
        let cur_vol = await connection.query(`SELECT * FROM MARKET_VOLUME`);
        let old_vol = await connection.query(`SELECT * FROM MARKET WHERE info = 'OLD_VOL'`);
        cur_price = cur_price.recordset[0];
        cur_vol = cur_vol.recordset[0];
        old_vol = old_vol.recordset[0];
        delete cur_price.info; delete old_vol.info;

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        let new_prices = {};
        for (const good in cur_vol) {
            console.log(good)
            let old_volume = old_vol[good];

            let new_volume = cur_vol[good];


            if (old_volume === 0) old_volume = 1;
            if (new_volume === 0) new_volume = 1;
            let change = old_volume / new_volume;

            let floor = 0.8;
            let ceiling = 1.2;

            if (CONSTANTS.LuxuryGoods.includes(good)) {
                floor += 0.1;
                ceiling += 0.1;
                change *= 1.05;
            }
            if (change > ceiling) {
                change = ceiling
            }
            if (change < floor) {
                change = floor;
            }
            let new_price = cur_price[good] * change;
            if (new_price < CONSTANTS.Init_Market_Prices[good]) {
                new_price = new_price * 1.02;
            }
            if (new_price < (0.33 * CONSTANTS.Init_Market_Prices[good])) {
                new_price = 0.33 * CONSTANTS.Init_Market_Prices[good];
            }
            if (new_price > (3 * CONSTANTS.Init_Market_Prices[good])) {
                new_price = 3 * CONSTANTS.Init_Market_Prices[good];
            }
            new_price = Math.round((new_price) * 100) / 100
            new_prices[good] = new_price;
            console.log(`${good} old vol: ${cur_price} new vol: ${new_volume}`)
            console.log(`${good} old price : ${cur_price[good]} new price: ${new_prices[good]} which is ${Math.round(new_prices[good] / cur_price[good] * 100)}% chance`)
        }


        // set calculated prices to CUR_PRICE row
        let update_price_query = 'UPDATE MARKET SET ';
        for (const good in new_prices) {
            update_price_query += `${good} = ${new_prices[good]}, `
        }
        update_price_query = update_price_query.substring(0, update_price_query.length - 2);
        update_price_query += ` WHERE info = 'CUR_PRICE'`

        // set OLD_PRICE row to what was CUR_PRICE row
        let update_old_price_query = `UPDATE MARKET SET `;
        for (const good in cur_price) {
            update_old_price_query += `${good} = ${cur_price[good]}, `
        }
        update_old_price_query = update_old_price_query.substring(0, update_old_price_query.length - 2);
        update_old_price_query += ` WHERE info = 'OLD_PRICE'`

        // set OLD_VOL row to what was in MARKET_VOLUME
        let update_old_vol_query = `UPDATE MARKET SET `;
        // new is now old, so set the cur_vol to the old_vol
        for (const good in cur_vol) {
            update_old_vol_query += `${good} = ${cur_vol[good]}, `
        }
        update_old_vol_query = update_old_vol_query.substring(0, update_old_vol_query.length - 2);
        update_old_vol_query += ` WHERE info = 'OLD_VOL'`



        // CLEAR MARKET_VOLUME
        let clear_market_vol_query = `UPDATE MARKET_VOLUME SET carrot = 0, melon = 0, cauliflower = 0, pumpkin = 0, yam = 0, beet = 0, parsnip = 0, bamboo = 0, hops = 0, corn = 0, potato = 0, blueberry = 0, grape = 0, oats = 0, strawberry = 0, chicken_egg = 0, cow_milk = 0, duck_egg = 0, quail_egg = 0, yak_milk = 0, sheep_wool = 0, goat_milk = 0, ostrich_egg = 0, llama_wool = 0, kiwi_egg = 0`;

        // Update prices (SQL +Market)
        console.log(update_price_query)
        console.log(update_old_price_query)
        await request.query(update_price_query);
        await request.query(update_old_price_query);
        await request.query(update_old_vol_query);

        // Clear old volume (SQL -Market +MARKET_VOLUME)

        await request.query(clear_market_vol_query);

        await transaction.commit()

    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback();
    } 
}





