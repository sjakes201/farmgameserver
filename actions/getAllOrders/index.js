const sql = require('mssql');
const { poolPromise } = require('../../db');
const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const ORDERS = require('../shared/ORDERS');


module.exports = async function (ws, actionData) {

    // VERIFY USER ID
    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);

        request.input('UserID', sql.Int, UserID);

        let lastRefresh = await request.query(`SELECT LastOrderRefresh FROM Profiles WHERE UserID = @UserID`);
        let ordersQuery = await request.query(`SELECT goal_1, progress_1, goal_2, progress_2, goal_3, progress_3, goal_4, progress_4, reward_1, reward_2, reward_3, reward_4 FROM ORDERS WHERE UserID = @UserID`);

        let lastTime = lastRefresh.recordset[0];
        let orders = ordersQuery.recordset[0];

        return {
            message: "SUCCESS",
            orders: [{
                good: orders.goal_1.split(" ")[0],
                numNeeded: parseInt(orders.goal_1.split(" ")[1]),
                numHave: orders.progress_1,
                reward: orders.reward_1
            }, {
                good: orders.goal_2.split(" ")[0],
                numNeeded: parseInt(orders.goal_2.split(" ")[1]),
                numHave: orders.progress_2,
                reward: orders.reward_2
            }, {
                good: orders.goal_3.split(" ")[0],
                numNeeded: parseInt(orders.goal_3.split(" ")[1]),
                numHave: orders.progress_3,
                reward: orders.reward_3
            }, {
                good: orders.goal_4.split(" ")[0],
                numNeeded: parseInt(orders.goal_4.split(" ")[1]),
                numHave: orders.progress_4,
                reward: orders.reward_4
            }],
            lastOrderRefresh: lastTime
        }

    } catch (error) {
        console.log(error);
        return {
            message: "DATABASE ERROR",
            orders: []
        }
    }
}





