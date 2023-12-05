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

        const selfRequest = UserID === targetUserID;

        request.multiple = true;
        let allInfo = await request.query(`
            ${selfRequest ? `UPDATE Logins SET LastSeen = ${Date.now()} WHERE UserID = @UserID;` : ``}
            SELECT Username FROM Logins WHERE UserID = @targetUserID;
            ${selfRequest ? `SELECT * FROM AnimalManagement WHERE UserID = @targetUserID;` : ``}
            SELECT Balance, XP, receivedPokes, totalContributedTownXP, profilePic FROM Profiles WHERE UserID = @targetUserID;
            ${!selfRequest ? `SELECT lastPoke FROM Profiles WHERE UserID = @UserID;` : ``}
            SELECT townName FROM Towns WHERE townID = (SELECT townID FROM TownMembers WHERE UserID = @targetUserID);
            ${selfRequest ? `SELECT * FROM Upgrades WHERE UserID = @targetUserID;` : ``}
            SELECT *, 'AllTime' AS leaderboardPositionsType FROM Leaderboard WHERE UserID = @targetUserID;
            SELECT *, 'Temp' AS leaderboardPositionsType FROM TempLeaderboard WHERE UserID = @targetUserID;
            SELECT * FROM LeaderboardSum WHERE UserID = @targetUserID;
            ${!selfRequest ? `WITH UserRelationship AS (    
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
                ` : ``
            }
        `)

        // For each leaderboard positions response, remove all positions that are > 10th
        allInfo.recordsets = allInfo.recordsets.map((recordset) => {
            if (recordset?.[0]?.leaderboardPositionsType) {
                let newPositionsInfo = { ...recordset[0] }
                Object.keys(newPositionsInfo).forEach((key) => {
                    if (key === "UserID" || key === "leaderboardPositionsType") return;
                    if (newPositionsInfo[key] > 10) {
                        delete newPositionsInfo[key]
                    }
                })
                return [newPositionsInfo]
            } else {
                return recordset
            }
        })

        let allProfile = {}


        allInfo.recordsets.forEach((recordset) => {
            if (recordset?.[0]?.leaderboardPositionsType) {
                let type = recordset[0].leaderboardPositionsType;
                delete recordset[0].UserID;
                delete recordset[0].leaderboardPositionsType;
                delete recordset[0].Username;
                allProfile = {
                    ...allProfile,
                    [`${type}LeaderboardPositions`]: recordset[0]
                }
            } else {
                allProfile = {
                    ...allProfile,
                    ...recordset?.[0]
                }
            }
        })

        delete allProfile.UserID
        if (selfRequest) {
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





