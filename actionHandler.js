const fs = require('fs');
const path = require('path');

const { broadcastToTown } = require('./broadcastFunctions')
const { giveUnlockID } = require('./unlockFunctions')

const actionsPath = path.join(__dirname, './actions');
const actions = {};

fs.readdirSync(actionsPath).forEach(dir => {
    // Ensure we're only looking at directories, not files directly under 'actions'
    const dirPath = path.join(actionsPath, dir);
    if (fs.statSync(dirPath).isDirectory()) {
        if (dir === 'shared') return;
        actions[dir] = require(`${dirPath}/index`);
    }
});

/* Helper function for giving sleepy unlock profile pic if playing between midnight and 6 am */
const playingLate = (UserID, offset) => {
    try {
        const nowUTC = new Date();
        // Convert time offset to milliseconds and subtract it from UTC time
        const userLocalTime = new Date(nowUTC - offset * 60000);
        if (userLocalTime.getUTCHours() >= 0 && userLocalTime.getUTCHours() < 6) {
            giveUnlockID(UserID, 10)
        }
    } catch (error) {
        console.log(error)
    }
}

const handleAction = async (ws, MESSAGE_ID, action, params) => {

    try {
        switch (action) {
            case 'prices':
                let pricesData = await actions.prices(ws, params);
                ws.send(JSON.stringify({ action: 'prices', MESSAGE_ID, body: pricesData }));
                break;
            case 'inventoryAll':
                let invData = await actions.inventoryAll(ws, params);
                ws.send(JSON.stringify({ action: 'inventoryAll', MESSAGE_ID, body: invData }));
                break;
            case 'profileInfo':
                let profData = await actions.profileInfo(ws, params);
                // Check for user playing at night for sleepy pfp
                playingLate(ws.UserID, params?.oStamp);
                // Check for user login streak
                actions.refreshLoginStreak(ws, params)

                ws.send(JSON.stringify({ action: 'profileInfo', MESSAGE_ID, body: profData }));
                break;
            case 'marketSell':
                let markSellData = await actions.marketSell(ws, params);
                ws.send(JSON.stringify({ action: 'marketSell', MESSAGE_ID, body: markSellData }));
                break;
            case 'allAnimals':
                let allAnData = await actions.allAnimals(ws, params);
                ws.send(JSON.stringify({ action: 'allAnimals', MESSAGE_ID, body: allAnData }));
                break;
            case 'getAllMachines':
                let allMacData = await actions.getAllMachines(ws, params);
                ws.send(JSON.stringify({ action: 'getAllMachines', MESSAGE_ID, body: allMacData }));
                break;
            case 'sellArtisanGood':
                let artSellData = await actions.sellArtisanGood(ws, params)
                ws.send(JSON.stringify({ action: 'sellArtisanGood', MESSAGE_ID, body: artSellData }));
                break;
            case 'buyMachine':
                let bmData = await actions.buyMachine(ws, params)
                ws.send(JSON.stringify({ action: 'buyMachine', MESSAGE_ID, body: bmData }));
                break;
            case 'useMachine':
                let umData = await actions.useMachine(ws, params)
                ws.send(JSON.stringify({ action: 'useMachine', MESSAGE_ID, body: umData }));
                break;
            case 'collectMachine':
                let cmData = await actions.collectMachine(ws, params)
                ws.send(JSON.stringify({ action: 'collectMachine', MESSAGE_ID, body: cmData }));
                break;
            case 'sellMachine':
                let smData = await actions.sellMachine(ws, params)
                ws.send(JSON.stringify({ action: 'sellMachine', MESSAGE_ID, body: smData }));
                break;
            case 'cancelMachine':
                let canData = await actions.cancelMachine(ws, params)
                ws.send(JSON.stringify({ action: 'cancelMachine', MESSAGE_ID, body: canData }));
                break;
            case 'leaderboard':
                let ldbData = await actions.leaderboard(ws, params)
                ws.send(JSON.stringify({ action: 'leaderboard', MESSAGE_ID, body: ldbData }));
                break;
            case 'resetPassword':
                let rpData = await actions.resetPassword(ws, params)
                ws.send(JSON.stringify({ action: 'resetPassword', MESSAGE_ID, body: rpData }));
                break;
            case 'nameAnimal':
                let naData = await actions.nameAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'nameAnimal', MESSAGE_ID, body: naData }));
                break;
            case 'deleteAnimal':
                let daData = await actions.deleteAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'deleteAnimal', MESSAGE_ID, body: daData }));
                break;
            case 'collect':
                let collectData = await actions.collect(ws, params)
                ws.send(JSON.stringify({ action: 'collect', MESSAGE_ID, body: collectData }));
                break;
            case 'feedAnimal':
                let feedData = await actions.feedAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'feedAnimal', MESSAGE_ID, body: feedData }));
                break;
            case 'plant':
                let plantData = await actions.plant(ws, params)
                ws.send(JSON.stringify({ action: 'plant', MESSAGE_ID, body: plantData }));
                break;
            case 'harvest':
                let harvestData = await actions.harvest(ws, params)
                ws.send(JSON.stringify({ action: 'harvest', MESSAGE_ID, body: harvestData }));
                break;
            case 'multiPlant':
                let multPData = await actions.multiPlant(ws, params)
                ws.send(JSON.stringify({ action: 'multiPlant', MESSAGE_ID, body: multPData }));
                break;
            case 'multiHarvest':
                let multHData = await actions.multiHarvest(ws, params)
                ws.send(JSON.stringify({ action: 'multiHarvest', MESSAGE_ID, body: multHData }));
                break;
            case 'fertilizeTile':
                let fertData = await actions.fertilizeTile(ws, params)
                ws.send(JSON.stringify({ action: 'fertilizeTile', MESSAGE_ID, body: fertData }));
                break;
            case 'tilesAll':
                let taData = await actions.tilesAll(ws, params)
                ws.send(JSON.stringify({ action: 'tilesAll', MESSAGE_ID, body: taData }));
                break;
            case 'getStats':
                let statsData = await actions.getStats(ws, params)
                ws.send(JSON.stringify({ action: 'getStats', MESSAGE_ID, body: statsData }));
                break;
            case 'claimOrder':
                let cloData = await actions.claimOrder(ws, params)
                ws.send(JSON.stringify({ action: 'claimOrder', MESSAGE_ID, body: cloData }));
                break;
            case 'refreshOrder':
                let roData = await actions.refreshOrder(ws, params)
                ws.send(JSON.stringify({ action: 'refreshOrder', MESSAGE_ID, body: roData }));
                break;
            case 'getAllOrders':
                let gaoData = await actions.getAllOrders(ws, params)
                ws.send(JSON.stringify({ action: 'getAllOrders', MESSAGE_ID, body: gaoData }));
                break;
            case 'buy':
                let buyData = await actions.buy(ws, params)
                ws.send(JSON.stringify({ action: 'buy', MESSAGE_ID, body: buyData }));
                break;
            case 'buyAnimal':
                let buyAnData = await actions.buyAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'buyAnimal', MESSAGE_ID, body: buyAnData }));
                break;
            case 'buyUpgrade':
                let buyUGData = await actions.buyUpgrade(ws, params)
                ws.send(JSON.stringify({ action: 'buyUpgrade', MESSAGE_ID, body: buyUGData }));
                break;
            case 'forgotPassEmail':
                let fpeData = await actions.forgotPassEmail(ws, params)
                ws.send(JSON.stringify({ action: 'forgotPassEmail', MESSAGE_ID, body: fpeData }));
                break;
            case 'userLogin':
                let ulData = await actions.userLogin(ws, params)
                ws.send(JSON.stringify({ action: 'userLogin', MESSAGE_ID, body: ulData }));
                break;
            case 'userRegister':
                let urData = await actions.userRegister(ws, params)
                ws.send(JSON.stringify({ action: 'userRegister', MESSAGE_ID, body: urData }));
                break;
            case 'getTownInfo':
                let tiData = await actions.getTownInfo(ws, params)
                ws.send(JSON.stringify({ action: 'getTownInfo', MESSAGE_ID, body: tiData }));
                break;
            case 'kickTownMember':
                let ktmData = await actions.kickTownMember(ws, params)
                ws.send(JSON.stringify({ action: 'kickTownMember', MESSAGE_ID, body: ktmData }));
                break;
            case 'joinTown':
                let joinTownData = await actions.joinTown(ws, params)
                ws.send(JSON.stringify({ action: 'joinTown', MESSAGE_ID, body: joinTownData }));
                break;
            case 'leaveTown':
                let ltData = await actions.leaveTown(ws, params)
                ws.send(JSON.stringify({ action: 'leaveTown', MESSAGE_ID, body: ltData }));
                break;
            case 'setTownDetails':
                let stdData = await actions.setTownDetails(ws, params)
                ws.send(JSON.stringify({ action: 'setTownDetails', MESSAGE_ID, body: stdData }));
                break;
            case 'setTownGoal':
                let stgData = await actions.setTownGoal(ws, params)
                ws.send(JSON.stringify({ action: 'setTownGoal', MESSAGE_ID, body: stgData }));
                break;
            case 'createTown':
                let crtData = await actions.createTown(ws, params)
                ws.send(JSON.stringify({ action: 'createTown', MESSAGE_ID, body: crtData }));
                break;
            case 'claimTownGoal':
                let ctgData = await actions.claimTownGoal(ws, params)
                ws.send(JSON.stringify({ action: 'claimTownGoal', MESSAGE_ID, body: ctgData }));
                break;
            case 'getRandomTowns':
                let grtData = await actions.getRandomTowns(ws, params)
                ws.send(JSON.stringify({ action: 'getRandomTowns', MESSAGE_ID, body: grtData }));
                break;
            case 'getTownPerks':
                let gtpData = await actions.getTownPerks(ws, params)
                ws.send(JSON.stringify({ action: 'getTownPerks', MESSAGE_ID, body: gtpData }));
                break;
            case 'getTopTowns':
                let gttData = await actions.getTopTowns(ws, params)
                ws.send(JSON.stringify({ action: 'getTopTowns', MESSAGE_ID, body: gttData }));
                break;
            case 'linkDiscordAcc':
                let discordAccData = await actions.linkDiscordAcc(ws, params)
                ws.send(JSON.stringify({ action: 'linkDiscordAcc', MESSAGE_ID, body: discordAccData }));
                break;
            case 'getProfileData':
                let profileData = await actions.getProfileData(ws, params)
                ws.send(JSON.stringify({ action: 'getProfileData', MESSAGE_ID, body: profileData }));
                break;
            case 'pokeUser':
                let pokeData = await actions.pokeUser(ws, params)
                ws.send(JSON.stringify({ action: 'pokeUser', MESSAGE_ID, body: pokeData }));
                break;
            case 'getTownMessages':
                let townMessagesData = await actions.getTownMessages(ws, params)
                // Assign town ID to connected user object for broadcasting now that they are here, then delete
                ws.townID = townMessagesData.userTownID;
                delete townMessagesData.userTownID;
                ws.send(JSON.stringify({ action: 'getTownMessages', MESSAGE_ID, body: townMessagesData }));
                break;
            case 'createTownMessage':
                let msgData = await actions.createTownMessage(ws, params)
                let userTownID = msgData.userTownID;
                let username = msgData.username;
                let messageID = msgData.messageID;
                let msgType = msgData.msgType;
                if (userTownID > 0 && msgData.messageContent && username && messageID) {
                    broadcastToTown(userTownID, msgData.messageContent, username, messageID, msgType)
                }
                delete msgData.userTownID;
                ws.send(JSON.stringify({ action: 'createTownMessage', MESSAGE_ID, body: msgData }));
                break;
            case 'promoteTownMemberRole':
                let promRData = await actions.promoteTownMemberRole(ws, params)
                ws.send(JSON.stringify({ action: 'promoteTownMemberRole', MESSAGE_ID, body: promRData }));
                break;
            case 'demoteTownMember':
                let demData = await actions.demoteTownMember(ws, params)
                ws.send(JSON.stringify({ action: 'demoteTownMember', MESSAGE_ID, body: demData }));
                break;
            case 'readTownMessage':
                let rtmData = await actions.readTownMessage(ws, params)
                ws.send(JSON.stringify({ action: 'readTownMessage', MESSAGE_ID, body: rtmData }));
                break;
            case 'getUnlockedPfp':
                let ulPfpData = await actions.getUnlockedPfp(ws, params)
                ws.send(JSON.stringify({ action: 'getUnlockedPfp', MESSAGE_ID, body: ulPfpData }));
                break;
            case 'setProfilePic':
                let setPfpData = await actions.setProfilePic(ws, params)
                ws.send(JSON.stringify({ action: 'setProfilePic', MESSAGE_ID, body: setPfpData }));
                break;
            case 'getFriendsData':
                let friendsData = await actions.getFriendsData(ws, params)
                ws.send(JSON.stringify({ action: 'getFriendsData', MESSAGE_ID, body: friendsData }));
                break;
            case 'sendFriendRequest':
                let sfrData = await actions.sendFriendRequest(ws, params)
                ws.send(JSON.stringify({ action: 'sendFriendRequest', MESSAGE_ID, body: sfrData }));
                break;
            case 'acceptFriendRequest':
                let afrData = await actions.acceptFriendRequest(ws, params)
                ws.send(JSON.stringify({ action: 'acceptFriendRequest', MESSAGE_ID, body: afrData }));
                break;
            case 'removeFriend':
                let remFrData = await actions.removeFriend(ws, params)
                ws.send(JSON.stringify({ action: 'removeFriend', MESSAGE_ID, body: remFrData }));
                break;
            case 'feedFriendAnimal':
                let feedFrData = await actions.feedFriendAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'feedFriendAnimal', MESSAGE_ID, body: feedFrData }));
                break;
            case 'buyTownPerk':
                let btpData = await actions.buyTownPerk(ws, params)
                ws.send(JSON.stringify({ action: 'buyTownPerk', MESSAGE_ID, body: btpData }));
                break;
            case 'chooseIndivTownGoal':
                let itgData = await actions.chooseIndivTownGoal(ws, params)
                ws.send(JSON.stringify({ action: 'chooseIndivTownGoal', MESSAGE_ID, body: itgData }));
                break;
            case 'getNotifications':
                let ntfData = await actions.getNotifications(ws, params)
                ws.send(JSON.stringify({ action: 'getNotifications', MESSAGE_ID, body: ntfData }));
                break;
            case 'acceptNotification':
                let antfData = await actions.acceptNotification(ws, params)
                ws.send(JSON.stringify({ action: 'acceptNotification', MESSAGE_ID, body: antfData }));
                break;
            case 'resolveJoinRequest':
                let rjrData = await actions.resolveJoinRequest(ws, params)
                ws.send(JSON.stringify({ action: 'resolveJoinRequest', MESSAGE_ID, body: rjrData }));
                break;
            case 'getActiveBoosts':
                let abData = await actions.getActiveBoosts(ws, params)
                ws.send(JSON.stringify({ action: 'getActiveBoosts', MESSAGE_ID, body: abData }));
                break;
            case 'buyTownBoost':
                let btbData = await actions.buyTownBoost(ws, params)
                ws.send(JSON.stringify({ action: 'buyTownBoost', MESSAGE_ID, body: btbData }));
                break;
            case 'getLoginStreakInfo':
                let lsiData = await actions.getLoginStreakInfo(ws,params);
                ws.send(JSON.stringify({ action: 'getLoginStreakInfo', MESSAGE_ID, body: lsiData }));
                break;
            case 'getPlayerBoostsInventory':
                let pbiData = await actions.getPlayerBoostsInventory(ws,params);
                ws.send(JSON.stringify({ action: 'getPlayerBoostsInventory', MESSAGE_ID, body: pbiData }));
                break;
            case 'buyPlayerBoost':
                let pbooData = await actions.buyPlayerBoost(ws,params);
                ws.send(JSON.stringify({ action: 'buyPlayerBoost', MESSAGE_ID, body: pbooData }));
                break;
            case 'activatePlayerBoost':
                let apbooData = await actions.activatePlayerBoost(ws,params);
                ws.send(JSON.stringify({ action: 'activatePlayerBoost', MESSAGE_ID, body: apbooData }));
                break;
            case 'getSpecialLeaderboard':
                let gslData = await actions.getSpecialLeaderboard(ws, params);
                ws.send(JSON.stringify({ action: 'getSpecialLeaderboard', MESSAGE_ID, body: gslData }));
                break;
            case 'buyProfilePic':
                let bpData = await actions.buyProfilePic(ws, params);
                ws.send(JSON.stringify({ action: 'buyProfilePic', MESSAGE_ID, body: bpData }));
                break;
        }
    } catch (error) {
        console.log(error)
    }

}

module.exports = { handleAction }