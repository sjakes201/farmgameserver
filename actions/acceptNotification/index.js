const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    const notificationID = actionData.notificationID;
    const action = actionData.action;

    const actionTypes = ["CLAIM"]

    if(!actionTypes.includes(action)) {
        return {
            success: false,
            message: `Invalid action ${action}`
        }
    }

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);

        request.input('UserID', sql.Int, UserID);
        request.input('notificationID', sql.Int, notificationID)

        let notificationsQuery = await request.query(`
            SELECT Type, GoldReward FROM UserNotifications WHERE UserID = @UserID AND NotificationID = @notificationID
        `);

        console.log(notificationsQuery)

        return {
            success: true,
            
        }

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "DATABASE ERROR",
        }
    }
}





