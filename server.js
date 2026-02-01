const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const sendMessage = (socket, message) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};
const startGameServer = (server) => {
  const wss = new WebSocketServer({ server });

  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 500;
  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 90;
  const BALL_SIZE = 12;
  const PADDLE_SPEED = 6;
  const BALL_SPEED = 5;
  const BALL_SPEED_INCREMENT = 0.35;
  const BALL_SPEED_MAX = 10;
  const WIN_SCORE = 7;
  const COUNTDOWN_MS = 3000;
  const GAMEOVER_MS = 5000;

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
    running: false,
    phase: "waiting",
    countdownUntil: null,
    gameoverAt: null,
    winner: null
  };

  const getCountdownSeconds = () => {
    if (!gameState.countdownUntil) {
      return null;
    }
    const remaining = Math.max(0, gameState.countdownUntil - Date.now());
    return Math.ceil(remaining / 1000);
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
      playersReady: gameState.players.map((player) => Boolean(player)),
      phase: gameState.phase,
      countdown: getCountdownSeconds(),
      winner: gameState.winner
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

  const scheduleCountdown = () => {
    gameState.running = false;
    gameState.phase = "countdown";
    gameState.countdownUntil = Date.now() + COUNTDOWN_MS;
  };

  const resetGame = () => {
    gameState.paddles[0].y = GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    gameState.paddles[1].y = GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    gameState.paddles[0].direction = 0;
    gameState.paddles[1].direction = 0;
    gameState.scores[0] = 0;
    gameState.scores[1] = 0;
    gameState.winner = null;
    gameState.gameoverAt = null;
    resetBall(Math.random() > 0.5 ? 1 : -1);
  };

  const startIfReady = () => {
    if (gameState.players[0] && gameState.players[1]) {
      if (!gameState.running) {
        scheduleCountdown();
      }
    } else {
      gameState.running = false;
      gameState.phase = "waiting";
      gameState.countdownUntil = null;
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
    const now = Date.now();
    gameState.paddles.forEach((paddle) => {
      paddle.y += paddle.direction * PADDLE_SPEED;
      paddle.y = Math.max(0, Math.min(GAME_HEIGHT - PADDLE_HEIGHT, paddle.y));
    });

    if (!gameState.running) {
      if (gameState.phase === "countdown" && gameState.countdownUntil && now >= gameState.countdownUntil) {
        gameState.running = true;
        gameState.phase = "playing";
        gameState.countdownUntil = null;
      }

      if (gameState.phase === "gameover" && gameState.gameoverAt && now >= gameState.gameoverAt) {
        resetGame();
        startIfReady();
      }

      broadcastState();
      return;
    }

    gameState.phase = "playing";
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
      const nextSpeed = Math.min(BALL_SPEED_MAX, Math.abs(gameState.ball.vx) + BALL_SPEED_INCREMENT);
      gameState.ball.vx = nextSpeed;
      const offset =
        (gameState.ball.y + BALL_SIZE / 2 - (leftPaddle.y + PADDLE_HEIGHT / 2)) /
        (PADDLE_HEIGHT / 2);
      gameState.ball.vy = Math.abs(gameState.ball.vx) * offset;
    }

    if (
      gameState.ball.x + BALL_SIZE >= GAME_WIDTH - PADDLE_WIDTH &&
      gameState.ball.y + BALL_SIZE >= rightPaddle.y &&
      gameState.ball.y <= rightPaddle.y + PADDLE_HEIGHT
    ) {
      const nextSpeed = Math.min(BALL_SPEED_MAX, Math.abs(gameState.ball.vx) + BALL_SPEED_INCREMENT);
      gameState.ball.vx = -nextSpeed;
      const offset =
        (gameState.ball.y + BALL_SIZE / 2 - (rightPaddle.y + PADDLE_HEIGHT / 2)) /
        (PADDLE_HEIGHT / 2);
      gameState.ball.vy = Math.abs(gameState.ball.vx) * offset;
    }

    if (gameState.ball.x + BALL_SIZE < 0) {
      gameState.scores[1] += 1;
      if (gameState.scores[1] >= WIN_SCORE) {
        gameState.running = false;
        gameState.phase = "gameover";
        gameState.winner = 1;
        gameState.gameoverAt = now + GAMEOVER_MS;
      } else {
        resetBall(1);
        scheduleCountdown();
      }
    }

    if (gameState.ball.x > GAME_WIDTH) {
      gameState.scores[0] += 1;
      if (gameState.scores[0] >= WIN_SCORE) {
        gameState.running = false;
        gameState.phase = "gameover";
        gameState.winner = 0;
        gameState.gameoverAt = now + GAMEOVER_MS;
      } else {
        resetBall(-1);
        scheduleCountdown();
      }
    }

    broadcastState();
  };

  resetGame();
  setInterval(updateGame, 1000 / 60);
};

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Pong server running on http://localhost:${port}`);
  });
  startGameServer(server);
}

module.exports = { app, startGameServer };
