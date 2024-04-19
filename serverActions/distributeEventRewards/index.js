const { poolPromise } = require('../../db'); 
const sql = require('mssql')

module.exports = async function () {

    // let connection;
    // let transaction;
    // try {
    //     connection = await poolPromise;
    //     transaction = new sql.Transaction(connection);
    //     await transaction.begin()
    //     let request = new sql.Request(transaction)
    //     let res = await connection.query(`
    //     SELECT[UserID], special1
    //     FROM [dbo].[LeaderboardSum]
    //     WHERE special1 > 0
    //     ORDER BY special1 desc
    //     `);

    //     const goldRewards = [750, 500, 400, 350, 300, 250, 200, 150, 125, 100]
    //     let rewardQuery = ``
    //     res.recordset.forEach((row, index) => {
    //         let reward = index < goldRewards.length ? goldRewards[index] : 50
    //         rewardQuery += ` INSERT INTO UserNotifications (UserID, Type, Message) VALUES (${row.UserID}, 'EVENT_REWARD', '{"eventName":"coconut","PremiumCurrency":${reward},"pfpUnlockID":29}'); `
        
    //     })
    //     await connection.query(rewardQuery)
    //     await transaction.commit()
    // } catch (error) {
    //     if(transaction) await transaction.rollback()
    //     console.log(error)
    // }


};

