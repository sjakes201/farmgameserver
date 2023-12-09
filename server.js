console.log('Server.js is starting...');

const WebSocket = require('ws');
const { PORT } = require('./config');
const { setupExpressServer } = require('./expressServer');
const { setupWebSocket } = require('./webSocketHandler');
const { scheduleTasks } = require('./cronJobs');
const { setWebSocket } = require('./webSocketInstance');
const { checkRateLimit, initializeCleanUp } = require('./rateLimitChecker');
const { initializeMessageCleanup } = require('./messageLimitChecker');
const mainBot = require('./discordBot/mainBot')

const { app, server } = setupExpressServer();

const wss = new WebSocket.Server({ noServer: true }); // Use "noServer: true" to prevent WebSocket.Server from creating an HTTP server
setWebSocket(wss);

server.on('upgrade', (request, socket, head) => {

  const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
  let ipv4 = clientIp.split(":")[0];

  if (checkRateLimit(ipv4)) {
    console.log(`Rate limit exceeded for IP ${ipv4}, destroying socket`);
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

setupWebSocket(wss);
scheduleTasks();
initializeCleanUp();
initializeMessageCleanup();

server.listen(PORT, () => {
  console.log('Listening on %d', server.address().port);
});
