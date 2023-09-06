module.exports = function(hub) {

  // Handles greeting request
  hub.on('greet', (name) => {
    console.log(`Greeting request from ${name}`);
    
    // Perform greeting logic and send response
    hub.invoke('greetResponse', `Hello ${name}`);
  });

};
