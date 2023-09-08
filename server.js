console.log('Server.js is starting...');
require('dotenv').config();


// Action functions
const prices = require('./actions/prices/index');
const tempAuth = require('./actions/tempAuth/index')
const inventoryAll = require('./actions/inventoryAll/index')
const profileInfo = require('./actions/profileInfo/index')
const marketSell = require('./actions/marketSell/index')
const allAnimals = require('./actions/allAnimals/index')
const getAllMachines = require('./actions/getAllMachines/index')
const sellArtisanGood = require('./actions/sellArtisanGood/index')
const buyMachine = require('./actions/buyMachine/index')
const useMachine = require('./actions/useMachine/index')
const collectMachine = require('./actions/collectMachine/index')
const sellMachine = require('./actions/sellMachine/index')
const cancelMachine = require('./actions/cancelMachine/index')
const leaderboard = require('./actions/leaderboard/index')
const resetPassword = require('./actions/resetPassword/index')
const nameAnimal = require('./actions/nameAnimal/index')
const deleteAnimal = require('./actions/deleteAnimal/index')
const collect = require('./actions/collect/index')
const feedAnimal = require('./actions/feedAnimal/index')
const plant = require('./actions/plant/index')
const harvest = require('./actions/harvest/index')
const multiPlant = require('./actions/multiPlant/index')
const multiHarvest = require('./actions/multiHarvest/index')
const fertilizeTile = require('./actions/fertilizeTile/index')
const tilesAll = require('./actions/tilesAll/index')
const getStats = require('./actions/getStats/index')
const claimOrder = require('./actions/claimOrder/index')
const refreshOrder = require('./actions/refreshOrder/index')
const getAllOrders = require('./actions/getAllOrders/index')
const buy = require('./actions/buy/index')
const buyAnimal = require('./actions/buyAnimal/index')
const buyUpgrade = require('./actions/buyUpgrade/index')
const forgotPassEmail = require('./actions/forgotPassEmail/index')
const userLogin = require('./actions/userLogin/index')
const userRegister = require('./actions/userRegister/index')

// Other imports
const scheduleTasks = require('./cronJobs');  
const url = require('url');
const jwt = require('jsonwebtoken');


scheduleTasks();



function decodeUserID(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    return {
      auth: true,
      UserID: decoded.UserID,
      message: 'Auth success'
    };
  } catch (e) {
    return {
      auth: false,
      UserID: -1,
      message: 'Authentication failure'
    };
  }
}
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws, req) => {
  try {
    const parameters = url.parse(req.url, true);
    const token = parameters.query.token;

    let userData = decodeUserID(token);
    if (userData.auth) {
      ws.UserID = userData.UserID;
    } else {
      let guestInfo = await tempAuth(ws)
      if (guestInfo.auth && guestInfo.token) {
        userData = decodeUserID(guestInfo.token);
        if (userData.auth) {
          ws.UserID = userData.UserID;
          ws.send(JSON.stringify({
            type: 'guest_auth',
            token: guestInfo.token
          }));
        } else {
          // This means there was an error while generating the guest token. Handle this error as required.
          ws.close(1008, 'Error generating guest token');
          return;
        }
      } else {
        // This means there was an error while generating the guest account. Handle this error as required.
        ws.close(1008, 'Error generating guest account');
        return;
      }
    }

    console.log(`Client UserID ${ws.UserID} connected`);

    ws.on('message', async (message) => {
      try {

        // console.log(`Received message => ${message}`);
        const parsedMessage = JSON.parse(message);

        const action = parsedMessage.action;
        const params = { ...parsedMessage }
        delete params.action;

        switch (action) {
          case 'prices':
            let pricesData = await prices(ws, params);
            ws.send(JSON.stringify({ action: 'prices', body: pricesData }));
            break;
          case 'inventoryAll':
            let invData = await inventoryAll(ws, params);
            ws.send(JSON.stringify({ action: 'inventoryAll', body: invData }));
            break;
          case 'profileInfo':
            let profData = await profileInfo(ws, params);
            ws.send(JSON.stringify({ action: 'profileInfo', body: profData }));
            break;
          case 'marketSell':
            let markSellData = await marketSell(ws, params);
            ws.send(JSON.stringify({ action: 'marketSell', body: markSellData }));
            break;
          case 'allAnimals':
            let allAnData = await allAnimals(ws, params);
            ws.send(JSON.stringify({ action: 'allAnimals', body: allAnData }));
            break;
          case 'getAllMachines':
            let allMacData = await getAllMachines(ws, params);
            ws.send(JSON.stringify({ action: 'getAllMachines', body: allMacData }));
            break;
          case 'sellArtisanGood':
            let artSellData = await sellArtisanGood(ws, params)
            ws.send(JSON.stringify({ action: 'sellArtisanGood', body: artSellData }));
            break;
          case 'buyMachine':
            let bmData = await buyMachine(ws, params)
            ws.send(JSON.stringify({ action: 'buyMachine', body: bmData }));
            break;
          case 'useMachine':
            let umData = await useMachine(ws, params)
            ws.send(JSON.stringify({ action: 'useMachine', body: umData }));
            break;
          case 'collectMachine':
            let cmData = await collectMachine(ws, params)
            ws.send(JSON.stringify({ action: 'collectMachine', body: cmData }));
            break;
          case 'sellMachine':
            let smData = await sellMachine(ws, params)
            ws.send(JSON.stringify({ action: 'sellMachine', body: smData }));
            break;
          case 'cancelMachine':
            let canData = await cancelMachine(ws, params)
            ws.send(JSON.stringify({ action: 'cancelMachine', body: canData }));
            break;
          case 'leaderboard':
            let ldbData = await leaderboard(ws, params)
            ws.send(JSON.stringify({ action: 'leaderboard', body: ldbData }));
            break;
          case 'resetPassword':
            let rpData = await resetPassword(ws, params)
            ws.send(JSON.stringify({ action: 'resetPassword', body: rpData }));
            break;
          case 'nameAnimal':
            let naData = await nameAnimal(ws, params)
            ws.send(JSON.stringify({ action: 'nameAnimal', body: naData }));
            break;
          case 'deleteAnimal':
            let daData = await deleteAnimal(ws, params)
            ws.send(JSON.stringify({ action: 'deleteAnimal', body: daData }));
            break;
          case 'collect':
            let collectData = await collect(ws, params)
            ws.send(JSON.stringify({ action: 'collect', body: collectData }));
            break;
          case 'feedAnimal':
            let feedData = await feedAnimal(ws, params)
            ws.send(JSON.stringify({ action: 'feedAnimal', body: feedData }));
            break;
          case 'plant':
            let plantData = await plant(ws, params)
            ws.send(JSON.stringify({ action: 'plant', body: plantData }));
            break;
          case 'harvest':
            let harvestData = await harvest(ws, params)
            ws.send(JSON.stringify({ action: 'harvest', body: harvestData }));
            break;
          case 'multiPlant':
            let multPData = await multiPlant(ws, params)
            ws.send(JSON.stringify({ action: 'multiPlant', body: multPData }));
            break;
          case 'multiHarvest':
            let multHData = await multiHarvest(ws, params)
            ws.send(JSON.stringify({ action: 'multiHarvest', body: multHData }));
            break;
          case 'fertilizeTile':
            let fertData = await fertilizeTile(ws, params)
            ws.send(JSON.stringify({ action: 'fertilizeTile', body: fertData }));
            break;
          case 'tilesAll':
            let taData = await tilesAll(ws, params)
            ws.send(JSON.stringify({ action: 'tilesAll', body: taData }));
            break;
          case 'getStats':
            let statsData = await getStats(ws, params)
            ws.send(JSON.stringify({ action: 'getStats', body: statsData }));
            break;
          case 'claimOrder':
            let cloData = await claimOrder(ws, params)
            ws.send(JSON.stringify({ action: 'claimOrder', body: cloData }));
            break;
          case 'refreshOrder':
            let roData = await refreshOrder(ws, params)
            ws.send(JSON.stringify({ action: 'refreshOrder', body: roData }));
            break;
          case 'getAllOrders':
            let gaoData = await getAllOrders(ws, params)
            ws.send(JSON.stringify({ action: 'getAllOrders', body: gaoData }));
            break;
          case 'buy':
            let buyData = await buy(ws, params)
            ws.send(JSON.stringify({ action: 'buy', body: buyData }));
            break;
          case 'buyAnimal':
            let buyAnData = await buyAnimal(ws, params)
            ws.send(JSON.stringify({ action: 'buyAnimal', body: buyAnData }));
            break;
          case 'buyUpgrade':
            let buyUGData = await buyUpgrade(ws, params)
            ws.send(JSON.stringify({ action: 'buyUpgrade', body: buyUGData }));
            break;
          case 'forgotPassEmail':
            let fpeData = await forgotPassEmail(ws, params)
            ws.send(JSON.stringify({ action: 'forgotPassEmail', body: fpeData }));
            break;
          case 'userLogin':
            let ulData = await userLogin(ws, params)
            ws.send(JSON.stringify({ action: 'userLogin', body: ulData }));
            break;
          case 'userRegister':
            let urData = await userRegister(ws, params)
            ws.send(JSON.stringify({ action: 'userRegister', body: urData }));
            break;
        }
      } catch (error) {
        console.log(error)
      }
    });

    ws.on('close', () => {
      console.log(`Client ${ws.UserID} disconnected`);
    });
  } catch (error) {
    console.log(error)
  }

});

const port = process.env.PORT || 8080

server.listen(port, () => {
  console.log('Listening on %d', server.address().port);
});
