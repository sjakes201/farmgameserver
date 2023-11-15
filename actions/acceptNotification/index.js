const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {
    const UserID = ws.UserID;

    const notificationID = actionData.notificationID;
    const processAction = actionData.processAction;

    const actionTypes = ["CLAIM"]

    if (!actionTypes.includes(processAction)) {
        return {
            success: false,
            message: `Invalid action ${processAction}`
        }
    }

    if (!Number.isInteger(notificationID) || notificationID < 0) {
        return {
            success: false,
            message: "Invalid notification ID"
        }
    }

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);

        request.input('UserID', sql.Int, UserID);
        request.input('notificationID', sql.Int, notificationID)

        if (processAction === "CLAIM") {
            let notificationsQuery = await request.query(`
                SELECT Type, GoldReward FROM UserNotifications WHERE UserID = @UserID AND NotificationID = @notificationID
            `);
            if (notificationsQuery.recordset.length === 0) {
                return {
                    success: false,
                    message: "No notification with that ID"
                }
            }
            if (notificationsQuery.recordset[0].Type === "INDIV_TOWN_GOAL_REWARD") {
                let goldReward = notificationsQuery.recordset[0].GoldReward;
                request.input('goldReward', sql.Int, goldReward);

                let settleQuery = await request.query(`
                    UPDATE Profiles SET Balance = Balance + @goldReward WHERE UserID = @UserID
                    DELETE FROM UserNotifications WHERE UserID = @UserID AND NotificationID = @notificationID
                `)

                return {
                    success: true,
                    goldReward: goldReward
                }
            }

        }

        return {
            success: false,
            message: 'No valid notification of this type found'
        }

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "DATABASE ERROR",
        }
    }
}





