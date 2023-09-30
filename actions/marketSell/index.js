const CONSTANTS = require('../shared/CONSTANTS');
const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;
    let item = actionData.item, count = actionData.count;


    if (typeof item !== "string" || !(item in CONSTANTS.Init_Market_Prices) || !Number.isInteger(count) || count < 0) {
        try {
            console.log(`INVALID /marketSell endpoint inputs ${item}`)
        } catch (error) { console.log(error) }
        return {
            message: "INVALID /market_sell inputs"
        };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        // Get price, does not need to be in transaction
        let price_result = await connection.query(`SELECT ${item} FROM MARKET WHERE info = 'CUR_PRICE'`);
        let revenue = price_result.recordset[0][item] * parseInt(count);

        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID)

        // Increase Balance in Profiles (SQL +Profiles)
        request.input('revenue', sql.Decimal(18,2), revenue);
        await request.query(`UPDATE Profiles SET Balance = Balance + @revenue WHERE UserID = @UserID`);



        request.input('count', sql.Int, parseInt(count))
        // Check if we had in inventory, decrease (SQl -Profiles +Inventory_PRODUCE)
        let removeProduce = await request.query(`
            UPDATE Inventory_PRODUCE SET ${item} = ${item} - @count WHERE UserID = @UserID
            SELECT ${item} FROM Inventory_PRODUCE WHERE UserID = @UserID
            `);

        let remaining = removeProduce.recordset[0][item];
        if (remaining < 0) {
            // Did not have sufficient count
            await transaction.rollback();
            return {
                message: "INSUFFICIENT PRODUCE COUNT"
            };
        }

        // Update market volume (SQl -Inventory_PRODUCE + MARKET_VOLUME)
        let marketVolQuery = await request.query(`UPDATE MARKET_VOLUME SET ${item} = ${item} + @count`);
        if (marketVolQuery.rowsAffected[0] === 0) {
            await transaction.rollback();
            return {
                message: 'MARKET VOL UPDATE ERROR'
            };
        }
        await transaction.commit();
        return {
            message: "SUCCESS"
        };
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: "ERROR in market_sell api call"
        };
    }

}





