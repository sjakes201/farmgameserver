const { poolPromise } = require('../../db');
const { townServerBroadcast } = require('../../broadcastFunctions')

module.exports = async function () {
    if (process.env.NODE_ENV === 'TESTING') {
        console.log("TESTING ENV, NOT RUNNING")
        return;
    }
    
    let connection;
    try {
        connection = await poolPromise;

        // Step 1: Retrieve Inactive Leaders
        const twoWeeksAgo = Date.now() - (2.5 * 7 * 24 * 60 * 60 * 1000);
        const inactiveLeaders = await connection.query(`
            SELECT TM.townID, TM.UserID
            FROM TownMembers TM
            INNER JOIN Logins L ON TM.UserID = L.UserID
            WHERE TM.RoleID = 4 AND L.lastSeen < ${twoWeeksAgo}
        `);

        for (const row of inactiveLeaders.recordset) {
            const townID = row.townID;
            const inactiveLeaderUserID = row.UserID;

            // Step 2: Identify New Leaders
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const newLeader = await connection.query(`
                SELECT TOP 1 TM.UserID, L.Username
                FROM TownMembers TM
                INNER JOIN Logins L ON TM.UserID = L.UserID
                INNER JOIN Profiles P ON TM.UserID = P.UserID
                WHERE TM.townID = ${townID} AND TM.RoleID < 4 AND L.lastSeen > ${oneWeekAgo}
                ORDER BY TM.RoleID DESC, P.XP DESC
            `);

            if (newLeader.recordset.length > 0) {
                const newLeaderID = newLeader.recordset[0].UserID;
                const newLeaderUsername = newLeader.recordset[0].Username

                // Step 3: Update Town Members
                await connection.query(`
                BEGIN TRAN
                    IF EXISTS (SELECT 1 FROM TownMembers WHERE UserID = ${newLeaderID} AND TownID = ${townID})
                    BEGIN
                        UPDATE TownMembers
                        SET RoleID = 4
                        WHERE UserID = ${newLeaderID}

                        UPDATE TownMembers
                        SET RoleID = 3
                        WHERE UserID = ${inactiveLeaderUserID}
                    END
                COMMIT
                `);
                townServerBroadcast(townID, `The town's leader has been inactive for 2 weeks and leadership has been transferred to ${newLeaderUsername}.`, "TOWN_BROADCAST")

            }
        }

        return {
            message: "SUCCESS"
        }
    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }

}
