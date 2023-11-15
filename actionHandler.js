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

const handleAction = async (ws, action, params) => {
    try {
        switch (action) {
            case 'prices':
                let pricesData = await actions.prices(ws, params);
                ws.send(JSON.stringify({ action: 'prices', body: pricesData }));
                break;
            case 'inventoryAll':
                let invData = await actions.inventoryAll(ws, params);
                ws.send(JSON.stringify({ action: 'inventoryAll', body: invData }));
                break;
            case 'profileInfo':
                let profData = await actions.profileInfo(ws, params);
                playingLate(ws.UserID, params?.oStamp);
                ws.send(JSON.stringify({ action: 'profileInfo', body: profData }));
                break;
            case 'marketSell':
                let markSellData = await actions.marketSell(ws, params);
                ws.send(JSON.stringify({ action: 'marketSell', body: markSellData }));
                break;
            case 'allAnimals':
                let allAnData = await actions.allAnimals(ws, params);
                ws.send(JSON.stringify({ action: 'allAnimals', body: allAnData }));
                break;
            case 'getAllMachines':
                let allMacData = await actions.getAllMachines(ws, params);
                ws.send(JSON.stringify({ action: 'getAllMachines', body: allMacData }));
                break;
            case 'sellArtisanGood':
                let artSellData = await actions.sellArtisanGood(ws, params)
                ws.send(JSON.stringify({ action: 'sellArtisanGood', body: artSellData }));
                break;
            case 'buyMachine':
                let bmData = await actions.buyMachine(ws, params)
                ws.send(JSON.stringify({ action: 'buyMachine', body: bmData }));
                break;
            case 'useMachine':
                let umData = await actions.useMachine(ws, params)
                ws.send(JSON.stringify({ action: 'useMachine', body: umData }));
                break;
            case 'collectMachine':
                let cmData = await actions.collectMachine(ws, params)
                ws.send(JSON.stringify({ action: 'collectMachine', body: cmData }));
                break;
            case 'sellMachine':
                let smData = await actions.sellMachine(ws, params)
                ws.send(JSON.stringify({ action: 'sellMachine', body: smData }));
                break;
            case 'cancelMachine':
                let canData = await actions.cancelMachine(ws, params)
                ws.send(JSON.stringify({ action: 'cancelMachine', body: canData }));
                break;
            case 'leaderboard':
                let ldbData = await actions.leaderboard(ws, params)
                ws.send(JSON.stringify({ action: 'leaderboard', body: ldbData }));
                break;
            case 'resetPassword':
                let rpData = await actions.resetPassword(ws, params)
                ws.send(JSON.stringify({ action: 'resetPassword', body: rpData }));
                break;
            case 'nameAnimal':
                let naData = await actions.nameAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'nameAnimal', body: naData }));
                break;
            case 'deleteAnimal':
                let daData = await actions.deleteAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'deleteAnimal', body: daData }));
                break;
            case 'collect':
                let collectData = await actions.collect(ws, params)
                ws.send(JSON.stringify({ action: 'collect', body: collectData }));
                break;
            case 'feedAnimal':
                let feedData = await actions.feedAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'feedAnimal', body: feedData }));
                break;
            case 'plant':
                let plantData = await actions.plant(ws, params)
                ws.send(JSON.stringify({ action: 'plant', body: plantData }));
                break;
            case 'harvest':
                let harvestData = await actions.harvest(ws, params)
                ws.send(JSON.stringify({ action: 'harvest', body: harvestData }));
                break;
            case 'multiPlant':
                let multPData = await actions.multiPlant(ws, params)
                ws.send(JSON.stringify({ action: 'multiPlant', body: multPData }));
                break;
            case 'multiHarvest':
                let multHData = await actions.multiHarvest(ws, params)
                ws.send(JSON.stringify({ action: 'multiHarvest', body: multHData }));
                break;
            case 'fertilizeTile':
                let fertData = await actions.fertilizeTile(ws, params)
                ws.send(JSON.stringify({ action: 'fertilizeTile', body: fertData }));
                break;
            case 'tilesAll':
                let taData = await actions.tilesAll(ws, params)
                ws.send(JSON.stringify({ action: 'tilesAll', body: taData }));
                break;
            case 'getStats':
                let statsData = await actions.getStats(ws, params)
                ws.send(JSON.stringify({ action: 'getStats', body: statsData }));
                break;
            case 'claimOrder':
                let cloData = await actions.claimOrder(ws, params)
                ws.send(JSON.stringify({ action: 'claimOrder', body: cloData }));
                break;
            case 'refreshOrder':
                let roData = await actions.refreshOrder(ws, params)
                ws.send(JSON.stringify({ action: 'refreshOrder', body: roData }));
                break;
            case 'getAllOrders':
                let gaoData = await actions.getAllOrders(ws, params)
                ws.send(JSON.stringify({ action: 'getAllOrders', body: gaoData }));
                break;
            case 'buy':
                let buyData = await actions.buy(ws, params)
                ws.send(JSON.stringify({ action: 'buy', body: buyData }));
                break;
            case 'buyAnimal':
                let buyAnData = await actions.buyAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'buyAnimal', body: buyAnData }));
                break;
            case 'buyUpgrade':
                let buyUGData = await actions.buyUpgrade(ws, params)
                ws.send(JSON.stringify({ action: 'buyUpgrade', body: buyUGData }));
                break;
            case 'forgotPassEmail':
                let fpeData = await actions.forgotPassEmail(ws, params)
                ws.send(JSON.stringify({ action: 'forgotPassEmail', body: fpeData }));
                break;
            case 'userLogin':
                let ulData = await actions.userLogin(ws, params)
                ws.send(JSON.stringify({ action: 'userLogin', body: ulData }));
                break;
            case 'userRegister':
                let urData = await actions.userRegister(ws, params)
                ws.send(JSON.stringify({ action: 'userRegister', body: urData }));
                break;
            case 'getTownInfo':
                let tiData = await actions.getTownInfo(ws, params)
                ws.send(JSON.stringify({ action: 'getTownInfo', body: tiData }));
                break;
            case 'kickTownMember':
                let ktmData = await actions.kickTownMember(ws, params)
                ws.send(JSON.stringify({ action: 'kickTownMember', body: ktmData }));
                break;
            case 'joinTown':
                let joinTownData = await actions.joinTown(ws, params)
                ws.send(JSON.stringify({ action: 'joinTown', body: joinTownData }));
                break;
            case 'leaveTown':
                let ltData = await actions.leaveTown(ws, params)
                ws.send(JSON.stringify({ action: 'leaveTown', body: ltData }));
                break;
            case 'setTownDetails':
                let stdData = await actions.setTownDetails(ws, params)
                ws.send(JSON.stringify({ action: 'setTownDetails', body: stdData }));
                break;
            case 'setTownGoal':
                let stgData = await actions.setTownGoal(ws, params)
                ws.send(JSON.stringify({ action: 'setTownGoal', body: stgData }));
                break;
            case 'createTown':
                let crtData = await actions.createTown(ws, params)
                ws.send(JSON.stringify({ action: 'createTown', body: crtData }));
                break;
            case 'claimTownGoal':
                let ctgData = await actions.claimTownGoal(ws, params)
                ws.send(JSON.stringify({ action: 'claimTownGoal', body: ctgData }));
                break;
            case 'getRandomTowns':
                let grtData = await actions.getRandomTowns(ws, params)
                ws.send(JSON.stringify({ action: 'getRandomTowns', body: grtData }));
                break;
            case 'getTownPerks':
                let gtpData = await actions.getTownPerks(ws, params)
                ws.send(JSON.stringify({ action: 'getTownPerks', body: gtpData }));
                break;
            case 'getTopTowns':
                let gttData = await actions.getTopTowns(ws, params)
                ws.send(JSON.stringify({ action: 'getTopTowns', body: gttData }));
                break;
            case 'linkDiscordAcc':
                let discordAccData = await actions.linkDiscordAcc(ws, params)
                ws.send(JSON.stringify({ action: 'linkDiscordAcc', body: discordAccData }));
                break;
            case 'getProfileData':
                let profileData = await actions.getProfileData(ws, params)
                ws.send(JSON.stringify({ action: 'getProfileData', body: profileData }));
                break;
            case 'pokeUser':
                let pokeData = await actions.pokeUser(ws, params)
                ws.send(JSON.stringify({ action: 'pokeUser', body: pokeData }));
                break;
            case 'getTownMessages':
                let townMessagesData = await actions.getTownMessages(ws, params)
                // Assign town ID to connected user object for broadcasting now that they are here, then delete
                ws.townID = townMessagesData.userTownID;
                delete townMessagesData.userTownID;
                ws.send(JSON.stringify({ action: 'getTownMessages', body: townMessagesData }));
                break;
            case 'createTownMessage':
                let msgData = await actions.createTownMessage(ws, params)
                let userTownID = msgData.userTownID;
                let username = msgData.username;
                let messageID = msgData.messageID;
                if (userTownID > 0 && msgData.messageContent && username && messageID) {
                    broadcastToTown(userTownID, msgData.messageContent, username, messageID)
                }
                delete msgData.userTownID;
                ws.send(JSON.stringify({ action: 'createTownMessage', body: msgData }));
                break;
            case 'promoteTownMemberRole':
                let promRData = await actions.promoteTownMemberRole(ws, params)
                ws.send(JSON.stringify({ action: 'promoteTownMemberRole', body: promRData }));
                break;
            case 'demoteTownMember':
                let demData = await actions.demoteTownMember(ws, params)
                ws.send(JSON.stringify({ action: 'demoteTownMember', body: demData }));
                break;
            case 'readTownMessage':
                let rtmData = await actions.readTownMessage(ws, params)
                ws.send(JSON.stringify({ action: 'readTownMessage', body: rtmData }));
                break;
            case 'getUnlockedPfp':
                let ulPfpData = await actions.getUnlockedPfp(ws, params)
                ws.send(JSON.stringify({ action: 'getUnlockedPfp', body: ulPfpData }));
                break;
            case 'setProfilePic':
                let setPfpData = await actions.setProfilePic(ws, params)
                ws.send(JSON.stringify({ action: 'setProfilePic', body: setPfpData }));
                break;
            case 'getFriendsData':
                let friendsData = await actions.getFriendsData(ws, params)
                ws.send(JSON.stringify({ action: 'getFriendsData', body: friendsData }));
                break;
            case 'sendFriendRequest':
                let sfrData = await actions.sendFriendRequest(ws, params)
                ws.send(JSON.stringify({ action: 'sendFriendRequest', body: sfrData }));
                break;
            case 'acceptFriendRequest':
                let afrData = await actions.acceptFriendRequest(ws, params)
                ws.send(JSON.stringify({ action: 'acceptFriendRequest', body: afrData }));
                break;
            case 'removeFriend':
                let remFrData = await actions.removeFriend(ws, params)
                ws.send(JSON.stringify({ action: 'removeFriend', body: remFrData }));
                break;
            case 'feedFriendAnimal':
                let feedFrData = await actions.feedFriendAnimal(ws, params)
                ws.send(JSON.stringify({ action: 'feedFriendAnimal', body: feedFrData }));
                break;
            case 'buyTownPerk':
                let btpData = await actions.buyTownPerk(ws, params)
                ws.send(JSON.stringify({ action: 'buyTownPerk', body: btpData }));
                break;
            case 'chooseIndivTownGoal':
                let itgData = await actions.chooseIndivTownGoal(ws, params)
                ws.send(JSON.stringify({ action: 'chooseIndivTownGoal', body: itgData }));
                break;
            case 'getNotifications':
                let ntfData = await actions.getNotifications(ws, params)
                ws.send(JSON.stringify({ action: 'getNotifications', body: ntfData }));
                break;
            case 'acceptNotification':
                let antfData = await actions.acceptNotification(ws, params)
                ws.send(JSON.stringify({ action: 'acceptNotification', body: antfData }));
                break;
        }
    } catch (error) {
        console.log(error)
    }

}

module.exports = { handleAction }