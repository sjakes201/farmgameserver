const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    // VERIFY USER ID
    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);

        request.input('UserID', sql.Int, UserID);

        let notificationsQuery = await request.query(`SELECT NotificationID, Timestamp, Type, Message, GoldReward, XpReward FROM UserNotifications WHERE UserID = @UserID`);

        return {
            success: true,
            notificationsData: notificationsQuery.recordset
        }

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "DATABASE ERROR",
        }
    }
}





