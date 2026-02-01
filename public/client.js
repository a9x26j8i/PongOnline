const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const leftScoreEl = document.getElementById("left-score");
const rightScoreEl = document.getElementById("right-score");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 90;
const BALL_SIZE = 12;

let playerIndex = null;
let currentDirection = 0;
let state = {
  paddles: [
    { y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    { y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2 }
  ],
  ball: { x: GAME_WIDTH / 2 - BALL_SIZE / 2, y: GAME_HEIGHT / 2 - BALL_SIZE / 2 },
  scores: [0, 0],
  running: false,
  playersReady: [false, false]
};

const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const searchParams = new URLSearchParams(window.location.search);
const configuredWsUrl =
  window.PONG_WS_URL ||
  searchParams.get("ws") ||
  `${wsProtocol}://${window.location.host}`;

let socket = null;
let reconnectTimer = null;
const reconnectDelayMs = 1500;

const updateStatus = (message) => {
  statusEl.textContent = message;
};

const scheduleReconnect = () => {
  if (reconnectTimer) {
    return;
  }
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelayMs);
};

const connect = () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  updateStatus("Connecting...");
  socket = new WebSocket(configuredWsUrl);

  socket.addEventListener("open", () => {
    updateStatus("Waiting for opponent...");
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "assign") {
      playerIndex = message.index;
      updateStatus("Assigned paddle. Waiting for opponent...");
      return;
    }

    if (message.type === "full") {
      updateStatus("Room is full. Try again later.");
      return;
    }

    if (message.type === "state") {
      state = message;
      leftScoreEl.textContent = state.scores[0];
      rightScoreEl.textContent = state.scores[1];
      if (!state.running) {
        updateStatus("Waiting for opponent...");
      } else {
        updateStatus("Game on!");
      }
    }
  });

  socket.addEventListener("close", () => {
    updateStatus("Disconnected. Reconnecting...");
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    updateStatus("Connection error. Reconnecting...");
    scheduleReconnect();
  });
};

connect();

const sendDirection = (direction) => {
  if (currentDirection === direction) {
    return;
  }
  currentDirection = direction;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "input",
      direction
    })
  );
};

const keyState = new Set();

const getDirectionFromKeys = () => {
  if (playerIndex === 0) {
    if (keyState.has("KeyW")) {
      return -1;
    }
    if (keyState.has("KeyS")) {
      return 1;
    }
  }

  if (playerIndex === 1) {
    if (keyState.has("ArrowUp")) {
      return -1;
    }
    if (keyState.has("ArrowDown")) {
      return 1;
    }
  }

  return 0;
};

const scrollKeys = new Set(["ArrowUp", "ArrowDown"]);

window.addEventListener("keydown", (event) => {
  if (scrollKeys.has(event.code)) {
    event.preventDefault();
  }
  keyState.add(event.code);
  sendDirection(getDirectionFromKeys());
});

window.addEventListener("keyup", (event) => {
  if (scrollKeys.has(event.code)) {
    event.preventDefault();
  }
  keyState.delete(event.code);
  sendDirection(getDirectionFromKeys());
});

const drawNet = () => {
  context.strokeStyle = "rgba(255, 255, 255, 0.2)";
  context.setLineDash([10, 14]);
  context.beginPath();
  context.moveTo(GAME_WIDTH / 2, 20);
  context.lineTo(GAME_WIDTH / 2, GAME_HEIGHT - 20);
  context.stroke();
  context.setLineDash([]);
};

const draw = () => {
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawNet();

  context.fillStyle = "#f5f7ff";
  context.fillRect(12, state.paddles[0].y, PADDLE_WIDTH, PADDLE_HEIGHT);
  context.fillRect(GAME_WIDTH - 12 - PADDLE_WIDTH, state.paddles[1].y, PADDLE_WIDTH, PADDLE_HEIGHT);

  context.fillStyle = "#fdf1b6";
  context.fillRect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE);

  if (!state.running) {
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    context.font = "24px sans-serif";
    context.textAlign = "center";
    context.fillText("Waiting for opponent", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
  }

  requestAnimationFrame(draw);
};

requestAnimationFrame(draw);
