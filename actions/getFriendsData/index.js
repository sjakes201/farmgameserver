const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    const UserID = ws.UserID;

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);
        request.multiple = true;
        request.input('UserID', sql.Int, UserID)

        let friendsData = await request.query(`
        SELECT
            F.sendTime,
            F.acceptedFlag,
            CASE 
                WHEN F.senderUserID = @UserID THEN RL.Username
                ELSE LS.Username
            END as friendUsername,
            CASE 
                WHEN F.senderUserID = @UserID THEN RL.LastSeen
                ELSE LS.LastSeen
            END as friendLastSeen,
            CASE 
                WHEN F.senderUserID = @UserID THEN F.senderLastFeed
                ELSE F.receiverLastFeed
            END as yourLastFeed,
            CASE 
                WHEN F.senderUserID = @UserID THEN F.receiverLastFeed
                ELSE F.senderLastFeed
            END AS theirLastFeed,
            CASE 
                WHEN F.senderUserID = @UserID THEN RP.profilePic
                ELSE SP.profilePic
            END as friendProfilePic
        FROM
            Friends F
        LEFT JOIN
            Logins LS ON F.senderUserID = LS.UserID
        LEFT JOIN
            Logins RL ON F.receiverUserID = RL.UserID
        LEFT JOIN
            Profiles SP ON F.senderUserID = SP.UserID
        LEFT JOIN
            Profiles RP ON F.receiverUserID = RP.UserID
        WHERE 
            ((F.receiverUserID = @UserID) OR (F.senderUserID = @UserID AND F.acceptedFlag = 1)) AND (F.acceptedFlag != 2);

        SELECT 
            F.sendTime,
            F.acceptedFlag,
            L.Username as friendUsername,
            P.profilePic AS friendProfilePic,
            'OUTGOING' AS status
        FROM
            Friends F
        LEFT JOIN
            Logins L ON F.receiverUserID = L.UserID
        LEFT JOIN
            Profiles P ON F.receiverUserID = P.UserID
        WHERE senderUserID = @UserID AND acceptedFlag = 0;
        `)

        let resultingData = friendsData.recordsets[0].map((friend) => {
            let friendInfo = { ...friend }
            delete friendInfo.friendLastSeen;

            let seenString = 'Not seen recently';
            let hoursPassed = (Date.now() - friend.friendLastSeen) / 1000 / 60 / 60

            if (hoursPassed < 0.1) {
                seenString = 'Online'
            } else if (hoursPassed >= 0.1 && hoursPassed < 1) {
                seenString = '< 1 hour ago'
            } else if (hoursPassed >= 1 && hoursPassed < 24) {
                seenString = '< 1 day ago'
            } else if (hoursPassed >= 24 && hoursPassed < 48) {
                seenString = '< 2 days ago'
            } else if (hoursPassed >= 48 && hoursPassed < 72) {
                seenString = '< 3 days ago'
            } else if (hoursPassed >= 72 && hoursPassed < 168) {
                seenString = '< 1 week ago'
            }

            friendInfo.friendLastActive = seenString;
            return friendInfo
        })

        return {
            success: true,
            friendsData: resultingData,
            outgoingRequests: friendsData.recordsets[1]
        }

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "Uncaught error"
        };
    }
}





