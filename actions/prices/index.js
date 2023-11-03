const sql = require('mssql')
const { poolPromise } = require('../../db');

module.exports = async function (ws, params) {

    let connection;
    try {
        connection = await poolPromise;
        let result = await connection.query(`SELECT * FROM MARKET`);
        let cur_prices = result.recordset[0];
        let old_prices = result.recordset[1];
        let bonuses = result.recordset[3]
        delete cur_prices.info;
        delete old_prices.info;
        delete bonuses.info

        return {
            message: 'SUCCESS',
            newPrices: cur_prices,
            oldPrices: old_prices,
            bonuses: bonuses
        }

    } catch (error) {
        console.log(error);
        return {
            message: "ERROR"
        }
    }
}





