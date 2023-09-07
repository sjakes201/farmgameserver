const MACHINESINFO = require('../shared/MACHINESINFO');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    // good = name and quality in string (ex "cheeseQ0" or "clothQ3")
    let good = actionData.good;
    // quantity: positive int
    let quantity = actionData.quantity;

    let goodPrices = MACHINESINFO.artisanPrices;
    if (!Object.keys(goodPrices).includes(good) || !Number.isInteger(quantity) || quantity < 1 || typeof good !== 'string') {
        return {
            message: `Invalid inputs good: ${good} quantity: ${quantity}`
        };
    }

    let totalRevenue = goodPrices[good] * quantity;

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('revenue', sql.Int, totalRevenue);
        request.input('quantity', sql.Int, quantity)

        let balanceQuery = await request.query(`UPDATE Profiles SET Balance = Balance + @revenue WHERE UserID = @UserID`)

        let goodsQuery = await request.query(`
        UPDATE Inventory_ARTISAN SET ${good} = ${good} - @quantity WHERE UserID = @UserID
        SELECT ${good} FROM Inventory_ARTISAN WHERE UserID = @UserID;
        `)
        let newCount = goodsQuery.recordset[0][good];
        
        if (newCount < 0) {
            console.log("invalid count");
            await transaction.rollback();
            return {
                message: `Insufficient ${good} count in inventory`
            }
        }

        await transaction.commit()
        return {
            message: 'SUCCESS'
        };
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: 'UNCAUGHT ERROR IN /sellMachine endpoint'
        }
    } 
}





