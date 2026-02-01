const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(port, () => {
  console.log(`Pong server running on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 90;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
const BALL_SPEED = 5;

const gameState = {
  players: [null, null],
  paddles: [
    { y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2, direction: 0 },
    { y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2, direction: 0 }
  ],
  ball: {
    x: GAME_WIDTH / 2 - BALL_SIZE / 2,
    y: GAME_HEIGHT / 2 - BALL_SIZE / 2,
    vx: BALL_SPEED,
    vy: BALL_SPEED * 0.6
  },
  scores: [0, 0],
  running: false
};

const sendMessage = (socket, message) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcastState = () => {
  const payload = {
    type: "state",
    paddles: gameState.paddles.map((p) => ({ y: p.y })),
    ball: {
      x: gameState.ball.x,
      y: gameState.ball.y
    },
    scores: gameState.scores,
    running: gameState.running,
    playersReady: gameState.players.map((player) => Boolean(player))
  };

  gameState.players.forEach((player) => {
    if (player) {
      sendMessage(player.socket, payload);
    }
  });
};

const resetBall = (direction = 1) => {
  gameState.ball.x = GAME_WIDTH / 2 - BALL_SIZE / 2;
  gameState.ball.y = GAME_HEIGHT / 2 - BALL_SIZE / 2;
  const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
  gameState.ball.vx = BALL_SPEED * direction;
  gameState.ball.vy = BALL_SPEED * Math.sin(angle);
};

const resetGame = () => {
  gameState.paddles[0].y = GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2;
  gameState.paddles[1].y = GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2;
  gameState.paddles[0].direction = 0;
  gameState.paddles[1].direction = 0;
  gameState.scores[0] = 0;
  gameState.scores[1] = 0;
  resetBall(Math.random() > 0.5 ? 1 : -1);
};

const startIfReady = () => {
  if (gameState.players[0] && gameState.players[1]) {
    if (!gameState.running) {
      gameState.running = true;
      resetBall(Math.random() > 0.5 ? 1 : -1);
    }
  } else {
    gameState.running = false;
  }
};

wss.on("connection", (socket) => {
  const openIndex = gameState.players.findIndex((player) => player === null);
  if (openIndex === -1) {
    sendMessage(socket, { type: "full" });
    socket.close();
    return;
  }

  const player = { socket, index: openIndex };
  gameState.players[openIndex] = player;
  sendMessage(socket, { type: "assign", index: openIndex });
  startIfReady();
  broadcastState();

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }

    if (message.type === "input" && typeof message.direction === "number") {
      gameState.paddles[openIndex].direction = Math.max(-1, Math.min(1, message.direction));
    }
  });

  socket.on("close", () => {
    if (gameState.players[openIndex]?.socket === socket) {
      gameState.players[openIndex] = null;
      gameState.paddles[openIndex].direction = 0;
      resetGame();
      startIfReady();
      broadcastState();
    }
  });
});

const updateGame = () => {
  gameState.paddles.forEach((paddle) => {
    paddle.y += paddle.direction * PADDLE_SPEED;
    paddle.y = Math.max(0, Math.min(GAME_HEIGHT - PADDLE_HEIGHT, paddle.y));
  });

  if (!gameState.running) {
    broadcastState();
    return;
  }

  gameState.ball.x += gameState.ball.vx;
  gameState.ball.y += gameState.ball.vy;

  if (gameState.ball.y <= 0 || gameState.ball.y + BALL_SIZE >= GAME_HEIGHT) {
    gameState.ball.vy *= -1;
    gameState.ball.y = Math.max(0, Math.min(GAME_HEIGHT - BALL_SIZE, gameState.ball.y));
  }

  const leftPaddle = gameState.paddles[0];
  const rightPaddle = gameState.paddles[1];

  if (
    gameState.ball.x <= PADDLE_WIDTH &&
    gameState.ball.y + BALL_SIZE >= leftPaddle.y &&
    gameState.ball.y <= leftPaddle.y + PADDLE_HEIGHT
  ) {
    gameState.ball.vx = Math.abs(gameState.ball.vx);
    const offset =
      (gameState.ball.y + BALL_SIZE / 2 - (leftPaddle.y + PADDLE_HEIGHT / 2)) /
      (PADDLE_HEIGHT / 2);
    gameState.ball.vy = BALL_SPEED * offset;
  }

  if (
    gameState.ball.x + BALL_SIZE >= GAME_WIDTH - PADDLE_WIDTH &&
    gameState.ball.y + BALL_SIZE >= rightPaddle.y &&
    gameState.ball.y <= rightPaddle.y + PADDLE_HEIGHT
  ) {
    gameState.ball.vx = -Math.abs(gameState.ball.vx);
    const offset =
      (gameState.ball.y + BALL_SIZE / 2 - (rightPaddle.y + PADDLE_HEIGHT / 2)) /
      (PADDLE_HEIGHT / 2);
    gameState.ball.vy = BALL_SPEED * offset;
  }

  if (gameState.ball.x + BALL_SIZE < 0) {
    gameState.scores[1] += 1;
    resetBall(1);
  }

  if (gameState.ball.x > GAME_WIDTH) {
    gameState.scores[0] += 1;
    resetBall(-1);
  }

  broadcastState();
};

resetGame();
setInterval(updateGame, 1000 / 60);
