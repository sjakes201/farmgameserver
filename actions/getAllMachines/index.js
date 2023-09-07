const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;
        const request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);

        // Get all data from Machines and from Inventory_PARTS and from Inventory_ARTISAN
        request.multiple = true;
        let allQuery = await request.query(`
        SELECT Username FROM Logins WHERE UserID = @UserID
        SELECT * FROM Machines WHERE UserID = @UserID
        SELECT Balance, XP FROM Profiles WHERE UserID = @UserID
        SELECT * FROM Inventory_PARTS WHERE UserID = @UserID
        SELECT * FROM Inventory_ARTISAN WHERE UserID = @UserID
        `)
        let usernameData = allQuery.recordsets[0][0]
        let machinesData = allQuery.recordsets[1][0]
        let profileData = allQuery.recordsets[2][0]
        let partsData = allQuery.recordsets[3][0]
        let artisanData = allQuery.recordsets[4][0]
        delete machinesData.UserID; delete partsData.UserID; delete artisanData.UserID;

        return { machinesData: machinesData, profileData: { ...profileData, ...usernameData }, partsData: partsData, artisanData: artisanData }
    } catch (error) {
        console.log(error);
        return {
            message: "Uncaught error in /getAllMachines"
        }
    }


}





