const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const canvas = document.querySelector("#boardCanvas");
const ctx = canvas.getContext("2d");
const nicknameInput = document.querySelector("#nicknameInput");
const roomInput = document.querySelector("#roomInput");
const shareInput = document.querySelector("#shareInput");
const hostBtn = document.querySelector("#hostBtn");
const joinBtn = document.querySelector("#joinBtn");
const localBtn = document.querySelector("#localBtn");
const copyBtn = document.querySelector("#copyBtn");
const restartBtn = document.querySelector("#restartBtn");
const undoBtn = document.querySelector("#undoBtn");
const connectionStatus = document.querySelector("#connectionStatus");
const matchStatus = document.querySelector("#matchStatus");
const turnBadge = document.querySelector("#turnBadge");
const blackPlayer = document.querySelector("#blackPlayer");
const whitePlayer = document.querySelector("#whitePlayer");
const moveList = document.querySelector("#moveList");

const state = {
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY)),
  moves: [],
  turn: BLACK,
  winner: EMPTY,
  mode: "idle",
  role: "spectator",
  peer: null,
  conn: null,
  roomId: "",
  players: { black: "等待", white: "等待" },
  hover: null,
  message: "创建或加入房间开始对战",
};

function randomName() {
  return `玩家${Math.floor(1000 + Math.random() * 9000)}`;
}

function ownName() {
  return nicknameInput.value.trim() || randomName();
}

function resetBoard(announce = true) {
  state.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  state.moves = [];
  state.turn = BLACK;
  state.winner = EMPTY;
  state.hover = null;
  state.message = "黑棋先手";
  if (announce) send({ type: "reset" });
  render();
}

function setStatus(text, connected = false) {
  connectionStatus.textContent = text;
  connectionStatus.style.color = connected ? "var(--accent)" : "var(--warn)";
}

function cellGeometry() {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const pad = 42;
  const gap = (canvas.width - pad * 2) / (BOARD_SIZE - 1);
  return { rect, scale, pad, gap };
}

function canvasPoint(event) {
  const { rect, scale } = cellGeometry();
  return {
    x: (event.clientX - rect.left) * scale,
    y: (event.clientY - rect.top) * scale,
  };
}

function pointToCell(point) {
  const { pad, gap } = cellGeometry();
  const col = Math.round((point.x - pad) / gap);
  const row = Math.round((point.y - pad) / gap);
  if (row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE) return null;
  const cx = pad + col * gap;
  const cy = pad + row * gap;
  if (Math.hypot(point.x - cx, point.y - cy) > gap * 0.42) return null;
  return { row, col };
}

function canPlay() {
  if (state.winner) return false;
  if (state.mode === "local") return true;
  if (state.mode !== "online") return false;
  return (state.role === "black" && state.turn === BLACK) || (state.role === "white" && state.turn === WHITE);
}

function placeStone(row, col, color, broadcast = true) {
  if (state.board[row][col] !== EMPTY || state.winner) return false;
  state.board[row][col] = color;
  state.moves.push({ row, col, color });
  state.winner = checkWinner(row, col, color) ? color : EMPTY;
  state.turn = color === BLACK ? WHITE : BLACK;
  state.message = state.winner ? `${colorName(state.winner)}获胜` : `轮到${colorName(state.turn)}`;
  if (broadcast) send({ type: "move", row, col, color });
  render();
  return true;
}

function checkWinner(row, col, color) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  return directions.some(([dr, dc]) => {
    let count = 1;
    count += countDirection(row, col, dr, dc, color);
    count += countDirection(row, col, -dr, -dc, color);
    return count >= 5;
  });
}

function countDirection(row, col, dr, dc, color) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE && state.board[r][c] === color) {
    count += 1;
    r += dr;
    c += dc;
  }
  return count;
}

function colorName(color) {
  return color === BLACK ? "黑棋" : "白棋";
}

function updatePlayers() {
  blackPlayer.textContent = `黑棋：${state.players.black}`;
  whitePlayer.textContent = `白棋：${state.players.white}`;
}

function updateMoveList() {
  moveList.innerHTML = "";
  state.moves
    .slice()
    .reverse()
    .forEach((move, index) => {
      const li = document.createElement("li");
      const step = state.moves.length - index;
      li.textContent = `${step}. ${colorName(move.color)} ${String.fromCharCode(65 + move.col)}${move.row + 1}`;
      moveList.appendChild(li);
    });
}

function drawBoard() {
  const { pad, gap } = cellGeometry();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const boardGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  boardGradient.addColorStop(0, "#efc789");
  boardGradient.addColorStop(1, "#c9924f");
  ctx.fillStyle = boardGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(65, 42, 19, 0.72)";
  ctx.lineWidth = 2;
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const p = pad + i * gap;
    ctx.beginPath();
    ctx.moveTo(pad, p);
    ctx.lineTo(canvas.width - pad, p);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p, pad);
    ctx.lineTo(p, canvas.height - pad);
    ctx.stroke();
  }

  [3, 7, 11].forEach((row) => {
    [3, 7, 11].forEach((col) => {
      ctx.beginPath();
      ctx.fillStyle = "rgba(65, 42, 19, 0.75)";
      ctx.arc(pad + col * gap, pad + row * gap, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  state.moves.forEach((move, index) => {
    drawStone(move.row, move.col, move.color, index === state.moves.length - 1);
  });

  if (state.hover && canPlay() && state.board[state.hover.row][state.hover.col] === EMPTY) {
    drawGhost(state.hover.row, state.hover.col, state.turn);
  }
}

function drawStone(row, col, color, latest) {
  const { pad, gap } = cellGeometry();
  const x = pad + col * gap;
  const y = pad + row * gap;
  const radius = gap * 0.38;
  const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 3, x, y, radius);
  if (color === BLACK) {
    gradient.addColorStop(0, "#657181");
    gradient.addColorStop(1, "#101820");
  } else {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#d7dde5");
  }
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color === BLACK ? "#05080b" : "#a7b0bb";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (latest) {
    ctx.beginPath();
    ctx.strokeStyle = color === BLACK ? "#f6d365" : "#0c7c59";
    ctx.lineWidth = 4;
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGhost(row, col, color) {
  const { pad, gap } = cellGeometry();
  ctx.beginPath();
  ctx.fillStyle = color === BLACK ? "rgba(16, 24, 32, 0.25)" : "rgba(255, 255, 255, 0.55)";
  ctx.arc(pad + col * gap, pad + row * gap, gap * 0.34, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  drawBoard();
  updatePlayers();
  updateMoveList();
  turnBadge.textContent = state.winner ? `${colorName(state.winner)}胜利` : `当前：${colorName(state.turn)}`;
  matchStatus.textContent = state.message;
}

function send(payload) {
  if (state.conn && state.conn.open) {
    state.conn.send({ ...payload, players: state.players });
  }
}

function receive(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.players) state.players = payload.players;
  if (payload.type === "move") {
    placeStone(payload.row, payload.col, payload.color, false);
  }
  if (payload.type === "reset") {
    resetBoard(false);
  }
  if (payload.type === "undo") {
    undoMove(false);
  }
  if (payload.type === "hello" && state.role === "black") {
    state.players.white = payload.name || "白棋玩家";
    state.message = "好友已加入，黑棋先手";
    send({ type: "welcome", players: state.players, board: state.board, moves: state.moves, turn: state.turn, winner: state.winner });
  }
  if (payload.type === "welcome") {
    state.players = payload.players || state.players;
    state.board = payload.board || state.board;
    state.moves = payload.moves || state.moves;
    state.turn = payload.turn || BLACK;
    state.winner = payload.winner || EMPTY;
    state.message = "已加入房间，等待黑棋落子";
  }
  render();
}

function connectEvents(conn) {
  state.conn = conn;
  conn.on("open", () => {
    state.mode = "online";
    setStatus("已连接", true);
    if (state.role === "white") {
      conn.send({ type: "hello", name: ownName() });
    }
    render();
  });
  conn.on("data", receive);
  conn.on("close", () => {
    setStatus("连接断开");
    state.message = "连接已断开，可重新创建或加入房间";
    render();
  });
  conn.on("error", () => {
    setStatus("连接错误");
  });
}

function ensurePeer(onReady) {
  if (!window.Peer) {
    setStatus("PeerJS 加载失败");
    state.message = "联机库加载失败，可先使用本地对战";
    render();
    return;
  }
  if (state.peer && !state.peer.destroyed) {
    onReady(state.peer);
    return;
  }
  const peer = new Peer();
  state.peer = peer;
  setStatus("连接中");
  peer.on("open", () => onReady(peer));
  peer.on("error", () => {
    setStatus("信令不可用");
    state.message = "公共信令服务暂不可用，可使用本地对战";
    render();
  });
}

function hostRoom() {
  const name = ownName();
  nicknameInput.value = name;
  ensurePeer((peer) => {
    state.role = "black";
    state.mode = "online";
    state.roomId = peer.id;
    state.players = { black: name, white: "等待加入" };
    roomInput.value = peer.id;
    const url = new URL("gomoku.html", window.location.href);
    url.searchParams.set("room", peer.id);
    shareInput.value = url.toString();
    state.message = "房间已创建，等待好友加入";
    setStatus("等待加入", true);
    peer.on("connection", (conn) => {
      if (state.conn && state.conn.open) {
        conn.close();
        return;
      }
      connectEvents(conn);
    });
    resetBoard(false);
  });
}

function joinRoom() {
  const roomId = roomInput.value.trim();
  if (!roomId) {
    state.message = "请输入房间码";
    render();
    return;
  }
  const name = ownName();
  nicknameInput.value = name;
  ensurePeer((peer) => {
    state.role = "white";
    state.mode = "online";
    state.players = { black: "房主", white: name };
    connectEvents(peer.connect(roomId, { reliable: true }));
    state.message = "正在加入房间";
    render();
  });
}

function startLocal() {
  state.mode = "local";
  state.role = "both";
  state.players = { black: "本地玩家 A", white: "本地玩家 B" };
  state.message = "本地对战已开始";
  setStatus("本地对战", true);
  resetBoard(false);
}

function undoMove(broadcast = true) {
  if (!state.moves.length || state.winner) return;
  const move = state.moves.pop();
  state.board[move.row][move.col] = EMPTY;
  state.turn = move.color;
  state.message = `已悔棋，轮到${colorName(state.turn)}`;
  if (broadcast) send({ type: "undo" });
  render();
}

canvas.addEventListener("mousemove", (event) => {
  state.hover = pointToCell(canvasPoint(event));
  render();
});

canvas.addEventListener("mouseleave", () => {
  state.hover = null;
  render();
});

canvas.addEventListener("click", (event) => {
  const cell = pointToCell(canvasPoint(event));
  if (!cell) return;
  if (!canPlay()) {
    state.message = state.winner ? `${colorName(state.winner)}已获胜` : "还没轮到你落子";
    render();
    return;
  }
  placeStone(cell.row, cell.col, state.turn);
});

hostBtn.addEventListener("click", hostRoom);
joinBtn.addEventListener("click", joinRoom);
localBtn.addEventListener("click", startLocal);
restartBtn.addEventListener("click", () => resetBoard(true));
undoBtn.addEventListener("click", () => undoMove(true));
copyBtn.addEventListener("click", async () => {
  if (!shareInput.value) return;
  await navigator.clipboard.writeText(shareInput.value);
  state.message = "邀请链接已复制";
  render();
});

window.addEventListener("resize", render);

window.render_game_to_text = () =>
  JSON.stringify({
    coordinateSystem: "15x15 board, rows and columns are zero-based from top-left",
    mode: state.mode,
    role: state.role,
    turn: colorName(state.turn),
    winner: state.winner ? colorName(state.winner) : null,
    players: state.players,
    moves: state.moves.map((move) => ({ row: move.row, col: move.col, color: colorName(move.color) })),
    message: state.message,
  });

window.advanceTime = () => {
  render();
};

function boot() {
  nicknameInput.value = localStorage.getItem("linkplay-name") || randomName();
  nicknameInput.addEventListener("change", () => localStorage.setItem("linkplay-name", nicknameInput.value.trim()));
  const room = new URLSearchParams(window.location.search).get("room");
  if (room) roomInput.value = room;
  render();
}

boot();
