const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    // GET USERID
    const UserID = ws.UserID;

    const targetUser = actionData.targetUser;

    let connection;
    try {
        connection = await poolPromise;

        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        request.input('targetUser', sql.VarChar, targetUser)

        let targetQuery = await request.query(`
        SELECT UserID FROM Logins WHERE Username = @targetUser
        `)
        if (targetQuery.recordset.length === 0) {
            return {
                message: "User does not exist"
            }
        }
        const targetUserID = targetQuery.recordset[0].UserID
        request.input('targetUserID', sql.Int, targetUserID)

        request.multiple = true;
        let allInfo;
        if (targetUserID === UserID) {
            allInfo = await request.query(`
            UPDATE Logins SET LastSeen = ${Date.now()} WHERE UserID = @UserID
            SELECT Username FROM Logins WHERE UserID = @UserID;
            SELECT * FROM AnimalManagement WHERE UserID = @UserID;
            SELECT Balance, XP, receivedPokes, totalContributedTownXP, profilePic FROM Profiles WHERE UserID = @UserID;
            SELECT townName FROM Towns WHERE townID = (SELECT townID FROM TownMembers WHERE UserID = @UserID)
            SELECT * FROM Upgrades WHERE UserID = @UserID;
            SELECT * FROM LeaderboardSum WHERE UserID = @UserID
            `);
        } else {
            allInfo = await request.query(`
            SELECT Username FROM Logins WHERE UserID = @targetUserID;
            SELECT Balance, XP, receivedPokes, totalContributedTownXP,profilePic FROM Profiles WHERE UserID = @targetUserID;
            SELECT lastPoke FROM Profiles WHERE UserID = @UserID;
            SELECT townName FROM Towns WHERE townID = (SELECT townID FROM TownMembers WHERE UserID = @targetUserID);
            SELECT * FROM LeaderboardSum WHERE UserID = @targetUserID;

            WITH UserRelationship AS (
                SELECT
                    F.senderUserID,
                    F.receiverUserID,
                    F.acceptedFlag
                FROM
                    Friends F
                WHERE
                    (F.senderUserID = @UserID AND F.receiverUserID = @targetUserID) OR
                    (F.senderUserID = @targetUserID AND F.receiverUserID = @UserID)
            )
            SELECT 
                CASE
                    WHEN (UR.senderUserID = @UserID AND UR.acceptedFlag = 0) THEN 'pending_sent'
                    WHEN (UR.receiverUserID = @UserID AND UR.acceptedFlag = 0) THEN 'pending_received'
                    WHEN (UR.acceptedFlag = 1) THEN 'friends'
                    WHEN (UR.acceptedFlag = 2) THEN 'not_friends'
                    WHEN UR.senderUserID IS NULL AND UR.receiverUserID IS NULL THEN 'not_friends'
                END AS friendStatus
            FROM 
                (VALUES (@UserID, @targetUserID)) AS U(UserID, TargetUserID)
            LEFT JOIN 
                UserRelationship UR ON U.UserID = UR.senderUserID OR U.UserID = UR.receiverUserID;
            
            `);
        }
        let allProfile = {}
        allInfo.recordsets.forEach((recordset) => {
            allProfile = {
                ...allProfile,
                ...recordset[0]
            }
        })

        delete allProfile.UserID
        if (targetUserID === UserID) {
            allProfile.isMe = true;
        }
        allProfile.username = targetUser;

        if (allInfo.recordset.length === 0) {
            return {
                message: 'Profile with that UserID does not exist'
            };
        }
        return allProfile;
    } catch (error) {
        console.log(error);
        return {
            message: 'Database connection failed'
        };
    }


}





