const { app, startGameServer } = require("../server");

module.exports = (req, res) => {
  if (res?.socket?.server && !res.socket.server.pongGameServer) {
    startGameServer(res.socket.server);
    res.socket.server.pongGameServer = true;
  }

  return app(req, res);
};
