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
const wsUrl = `${wsProtocol}://${window.location.host}`;
const socket = new WebSocket(wsUrl);

const updateStatus = (message) => {
  statusEl.textContent = message;
};

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
  updateStatus("Disconnected. Refresh to reconnect.");
});

const sendDirection = (direction) => {
  if (currentDirection === direction) {
    return;
  }
  currentDirection = direction;
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

window.addEventListener("keydown", (event) => {
  keyState.add(event.code);
  sendDirection(getDirectionFromKeys());
});

window.addEventListener("keyup", (event) => {
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
