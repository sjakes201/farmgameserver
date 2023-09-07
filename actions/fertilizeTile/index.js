
const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');


module.exports = async function (ws, actionData) {
    // GET USERID
    const UserID = ws.UserID;

    let tileID = actionData.tileID;
    if (!Number.isInteger(tileID) || tileID < 1 || tileID > 60) {
        return {
            message: "invalid tileID"
        }
    }

    let fertilizerType = actionData.fertilizerType;
    let newVal;
    // newVal is based on fertilizer type, also check for valid input here
    switch (fertilizerType) {
        case 'TimeFertilizer':
            newVal = Date.now();
            break;
        case 'YieldsFertilizer':
            newVal = 10;
            break;
        case 'HarvestsFertilizer':
            newVal = 5;
            break;
        default:
            return {
                message: `Invalid fertilizer type ${fertilizerType}`
            };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('UserID', sql.Int, UserID);
        request.input('tileID', sql.Int, tileID);



        let fertilizeQuery = await request.query(`
        UPDATE CropTiles SET ${fertilizerType} = ${newVal} WHERE UserID = @UserID AND TileID = @tileID
        UPDATE Inventory_EXTRA SET ${fertilizerType} = ${fertilizerType} - 1 WHERE UserID = @UserID
        SELECT ${fertilizerType} from Inventory_EXTRA WHERE UserID = @UserID
        `)
        if (fertilizeQuery.recordset[0][fertilizerType] < 0) {
            await transaction.rollback()
            return {
                message: "Fertilizer not in inventory"
            };
        }

        await transaction.commit()
        return {
            message: 'SUCCESS'
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: 'ERROR'
        }

    }

}





