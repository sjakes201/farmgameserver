const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function (ws, actionData) {

    // VERIFY AUTH
    const UserID = ws.UserID;

    // GET INPUTS
    let name = actionData?.name;
    let Animal_ID = actionData?.Animal_ID;

    if(typeof name !== 'string' || name.length <= 0 || name.length > 10 || !Number.isInteger(Animal_ID) || Animal_ID < 0) {
        return {
            message: "Invalid nameAnimal inputs"
        };
    }

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);
        request.input("UserID", sql.Int, UserID);
        request.input('Name', sql.VarChar, name);
        request.input("Animal_ID", sql.Int, Animal_ID);
        let nameChange = await request.query(`UPDATE Animals SET Name = @Name WHERE UserID = @UserID AND Animal_ID = @Animal_ID`);
        
        // verify rowsAffected
        if(nameChange.rowsAffected[0] === 0) {
            return {
                message: "Animal not found with user"
            };
        }
        return {
            message: "Name change success"
        }

    } catch (error) {
        console.log(error);
        return {
            message: "Name change failure"
        }
    } 
}





