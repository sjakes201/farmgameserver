const sql = require('mssql');
const { poolPromise } = require('../../db');


module.exports = async function (ws, actionData) {

    let UserID = ws.UserID;

    let townName = actionData.townName;

    if (typeof townName !== 'string' || townName.length > 32) {
        return {
            message: 'Invalid town name, must be <= 32 length string'
        };
    }

    let connection;
    try {
        connection = await poolPromise;

        const request = new sql.Request(connection);
        request.multiple = true;
        request.input(`UserID`, sql.Int, UserID)
        request.input(`townName`, sql.VarChar(32), townName)

        let townInfo = await request.query(`
        SELECT townID FROM TownMembers WHERE UserID = @UserID
        SELECT * FROM Towns WHERE townName = @townName
        `)
        const myTownID = townInfo?.recordsets?.[0]?.[0]?.townID;

        let targetTown = townInfo.recordsets[1][0]
        // Are you in the town? No = you are just viewing, and will receive less information
        // TODO: add contributions fetch to this
        let moreTownInfo = await request.query(`
        SELECT UserID, RoleID FROM TownMembers WHERE townID = ${targetTown.townID}
        SELECT * FROM TownGoals WHERE townID = ${targetTown.townID}
        `)
        let myRoleID = moreTownInfo.recordsets[0].filter((obj) => {
            return obj.UserID === UserID
        })?.[0]?.RoleID;


        // goal number is at index - 1
        // Towngoals 1,2,3 and 4 are selected by leader, 5,6,7,8 are random
        let goals = [moreTownInfo.recordsets[1][0].goal_1, moreTownInfo.recordsets[1][0].goal_2, moreTownInfo.recordsets[1][0].goal_3, moreTownInfo.recordsets[1][0].goal_4, moreTownInfo.recordsets[1][0].goal_5, moreTownInfo.recordsets[1][0].goal_6, moreTownInfo.recordsets[1][0].goal_7, moreTownInfo.recordsets[1][0].goal_8]
        let progresses = [moreTownInfo.recordsets[1][0].progress_1, moreTownInfo.recordsets[1][0].progress_2, moreTownInfo.recordsets[1][0].progress_3, moreTownInfo.recordsets[1][0].progress_4, moreTownInfo.recordsets[1][0].progress_5, moreTownInfo.recordsets[1][0].progress_6, moreTownInfo.recordsets[1][0].progress_7, moreTownInfo.recordsets[1][0].progress_8]
        let goalsData = []
        goals.forEach((goal, index) => {
            goalsData.push({
                good: goals[index].split(" ")[0],
                numNeeded: goals[index].split(" ")[1],
                numHave: progresses[index]
            })
        })
        // This will specify all users for searches in tables
        let allMembers = moreTownInfo.recordsets[0];
        let userWhereQuery = `WHERE UserID IN (`;
        allMembers.forEach((userObject, index) => {
            if (index !== moreTownInfo.recordsets[0].length - 1) {
                userWhereQuery += `${userObject.UserID}, `;
            } else {
                userWhereQuery += `${userObject.UserID})`;
            }
        })

        let membersInfoQuery = await request.query(`
        SELECT UserID, Username, LastSeen FROM Logins ${userWhereQuery}
        SELECT UserID, XP FROM Profiles ${userWhereQuery}
        SELECT RoleID, contributedTownXP, UserID FROM TownMembers ${userWhereQuery}
        SELECT UserID, progress_1, progress_2, progress_3, progress_4, progress_5, progress_6, progress_7, progress_8 FROM TownContributions ${userWhereQuery}
        SELECT unclaimed_1, unclaimed_2, unclaimed_3, unclaimed_4, unclaimed_5, unclaimed_6, unclaimed_7, unclaimed_8 FROM TownContributions WHERE UserID = @UserID
        `);

        let playersData = []
        membersInfoQuery.recordsets[0].forEach((member) => {
            // find member in second set, will not always be at same index
            let targetPlayerGoals = membersInfoQuery.recordsets[3].filter((p) => p.UserID === member.UserID)[0];
            let targetPlayerInfo = membersInfoQuery.recordsets[1].filter((p) => p.UserID === member.UserID)[0];
            let roleID = membersInfoQuery.recordsets[2].filter((p) => p.UserID === member.UserID)[0].RoleID;
            let contributedTownXP = membersInfoQuery.recordsets[2].filter((p) => p.UserID === member.UserID)[0].contributedTownXP;
            let playerContributions = {};
            goalsData.forEach((goalObj, index) => {
                if (goalObj.good in playerContributions) {
                    playerContributions[goalObj.good] += targetPlayerGoals[`progress_${index + 1}`];
                } else {
                    playerContributions[goalObj.good] = targetPlayerGoals[`progress_${index + 1}`]
                }
            })
            // Last seen will be a certain amount of hours ago, 1 day, or two days
            let hoursPassed = (member.LastSeen - Date.now()) / 1000 / 60 / 60;
            let reportedTimePassed;
            if (hoursPassed < (1 / 6)) {
                reportedTimePassed = 0;
            } else if (hoursPassed >= (1 / 6) && hoursPassed < 1) {
                reportedTimePassed = 1;
            } else if (hoursPassed >= 1 && hoursPassed < 24) {
                reportedTimePassed = Math.round(hoursPassed);
            } else if (hoursPassed >= 24 && hoursPassed < 48) {
                reportedTimePassed = 24;
            } else {
                reportedTimePassed = 48;
            }
            let playerData = {
                username: member.Username,
                xp: targetPlayerInfo.XP,
                roleID: roleID
            }
            // Only provide contributions if they are in the town
            if (myRoleID) {
                playerData.contributions = playerContributions;
                playerData.contributedTownXP = contributedTownXP;
                // playerData.reportedTimePassed = reportedTimePassed;
            }
            playersData.push(playerData)
        })
        let imInTown = false;
        if (townInfo?.recordsets?.[0]?.[0]?.townID) {
            imInTown = true;
        }
        let myUnclaimed = membersInfoQuery.recordsets[4][0];
        if (!myRoleID) {
            return {
                townLogoNum: targetTown.townLogoNum,
                townName: targetTown.townName,
                description: targetTown.townDescription,
                memberCount: targetTown.memberCount,
                status: targetTown.status,
                playersData: playersData,
                // goalsData: goalsData,
                growthPerkLevel: targetTown.growthPerkLevel,
                partsPerkLevel: targetTown.partsPerkLevel,
                orderRefreshPerkLevel: targetTown.orderRefreshLevel,
                animalPerkLevel: targetTown.animalPerkLevel,
                // Data personal to requester
                myUnclaimed: myUnclaimed,
                imInTown: imInTown,
                townXP: targetTown.townXP,
                myRoleID: myRoleID
            }
        }
        return {
            townLogoNum: targetTown.townLogoNum,
            townName: targetTown.townName,
            description: targetTown.townDescription,
            memberCount: targetTown.memberCount,
            status: targetTown.status,
            playersData: playersData,
            goalsData: goalsData,
            growthPerkLevel: targetTown.growthPerkLevel,
            partsPerkLevel: targetTown.partsPerkLevel,
            orderRefreshPerkLevel: targetTown.orderRefreshLevel,
            animalPerkLevel: targetTown.animalPerkLevel,
            // Data personal to requester
            myUnclaimed: myUnclaimed,
            imInTown: imInTown,
            townXP: targetTown.townXP,
            myRoleID: myRoleID
        }

    } catch (error) {
        console.log(error);
        return {
            message: "UNCAUGHT ERROR"
        };
    }
}





