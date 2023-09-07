const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    let AnimalID = actionData?.AnimalID;
    let location = actionData?.location;
    if (!Number.isInteger(AnimalID) || !(location === 'coop' || location === 'barn')) {
        return {
            message: "INVALID DELETE ANIMAL INPUTS"
        };
    }
    const UserID = ws.UserID;


    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin()

        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('Animal_ID', sql.Int, AnimalID);
        let capacityQuery = await (request.query(`UPDATE AnimalManagement SET ${location.concat('Animals')} = ${location.concat('Animals')} - 1 WHERE UserID = @UserID`));
        let deletedQuery = await request.query(`DELETE FROM Animals WHERE UserID = @UserID AND Animal_ID = @Animal_ID`)


        if (deletedQuery.rowsAffected[0] === 0 || capacityQuery.rowsAffected[0] === 0) {
            await transaction.rollback();
            return {
                message: "UserID/AnimalID combination does not exist in database"
            }
        } else {
            await transaction.commit();
            return {
                message: "DELETE ANIMAL SUCCESS"
            }
        }
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: "Delete animal error"
        }
    }

}





