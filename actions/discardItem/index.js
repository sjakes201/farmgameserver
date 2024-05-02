const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS')

module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;
    const itemName = actionData.itemName;

    let connection;
    try {
        let allSeeds = Object.keys(CONSTANTS.ProduceIDs)
        
        if(!allSeeds.includes(itemName)){
            return {
                success: false,
                message: "Invalid Item Name"
            }
        }

        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID)
        let query = await request.query(`
            UPDATE Inventory_SEEDS SET ${itemName} = 0 WHERE UserID = @UserID
        `)

        return {
            success: true,
        };

    } catch (error) {
        console.log(error)
        return {
            success: false,
        }
    }
}





