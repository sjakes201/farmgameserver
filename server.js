const express = require('express');
const signalR = require('@aspnet/signalr');

const helloHub = require('./signalrHubs/hello');
// import other hubs as needed

const app = express();

let httpServer = app.listen(3001, () => {
  console.log('Server started on http://localhost:3001/');
});

const hub = new signalR.HubConnectionBuilder()
  .withUrl("/hub")
  .build();

hub.start()
  .then(() => {
    console.log('Hub connection started');
  })
  .catch(err => {
    console.error(`Error while establishing connection: ${err}`);
  });

// Wire up hub handlers
helloHub(hub);
// wire up other hubs as needed
