const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const STORAGE_KEY = "linkplay-gomoku-session-v1";
const DEFAULT_PEER_HOST = "0.peerjs.com";
const DEFAULT_PEER_PORT = 443;
const DEFAULT_PEER_PATH = "/";
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

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
const recordSession = document.querySelector("#recordSession");
const totalGames = document.querySelector("#totalGames");
const blackWins = document.querySelector("#blackWins");
const whiteWins = document.querySelector("#whiteWins");
const resultModal = document.querySelector("#resultModal");
const resultTitle = document.querySelector("#resultTitle");
const resultSummary = document.querySelector("#resultSummary");
const modalTotalGames = document.querySelector("#modalTotalGames");
const modalBlackWins = document.querySelector("#modalBlackWins");
const modalWhiteWins = document.querySelector("#modalWhiteWins");
const playAgainBtn = document.querySelector("#playAgainBtn");
const exitRoomBtn = document.querySelector("#exitRoomBtn");

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
  record: { total: 0, black: 0, white: 0 },
  recordLabel: "新房间",
  gameCounted: false,
  suppressCloseNotice: false,
  restoring: false,
};

function makeRoomId() {
  if (window.crypto && crypto.randomUUID) return `lp-${crypto.randomUUID().slice(0, 8)}`;
  return `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomName() {
  return `玩家${Math.floor(1000 + Math.random() * 9000)}`;
}

function ownName() {
  return nicknameInput.value.trim() || randomName();
}

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function parseBool(value, fallback) {
  if (value == null) return fallback;
  return value !== "false" && value !== "0";
}

function buildIceServers(params) {
  const iceServers = [...DEFAULT_ICE_SERVERS];
  const turnUrls = (params.get("turnUrls") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const turnUsername = params.get("turnUsername") || "";
  const turnCredential = params.get("turnCredential") || "";
  if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
  }
  return iceServers;
}

function peerRuntimeConfig() {
  const params = currentParams();
  return {
    host: params.get("peerHost") || DEFAULT_PEER_HOST,
    port: Number(params.get("peerPort") || DEFAULT_PEER_PORT),
    path: params.get("peerPath") || DEFAULT_PEER_PATH,
    secure: parseBool(params.get("peerSecure"), true),
    key: params.get("peerKey") || undefined,
    config: { iceServers: buildIceServers(params) },
    debug: 1,
  };
}

function applyPeerConfigToUrl(url) {
  const params = currentParams();
  ["peerHost", "peerPort", "peerPath", "peerSecure", "peerKey", "turnUrls", "turnUsername", "turnCredential"].forEach((key) => {
    const value = params.get(key);
    if (value) url.searchParams.set(key, value);
  });
}

function colorName(color) {
  return color === BLACK ? "黑棋" : "白棋";
}

function sessionSnapshot() {
  return {
    board: state.board,
    moves: state.moves,
    turn: state.turn,
    winner: state.winner,
    mode: state.mode,
    role: state.role,
    roomId: state.roomId,
    players: state.players,
    message: state.message,
    record: state.record,
    recordLabel: state.recordLabel,
    gameCounted: state.gameCounted,
  };
}

function saveSession() {
  if (state.restoring) return;
  if (state.mode === "idle") {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionSnapshot()));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function applySession(saved) {
  if (!saved) return false;
  state.board = saved.board || state.board;
  state.moves = saved.moves || [];
  state.turn = saved.turn || BLACK;
  state.winner = saved.winner || EMPTY;
  state.mode = saved.mode || "idle";
  state.role = saved.role || "spectator";
  state.roomId = saved.roomId || "";
  state.players = saved.players || state.players;
  state.message = saved.message || state.message;
  state.record = saved.record || state.record;
  state.recordLabel = saved.recordLabel || state.recordLabel;
  state.gameCounted = Boolean(saved.gameCounted);
  return true;
}

function resetRoomRecord(label = "新房间") {
  state.record = { total: 0, black: 0, white: 0 };
  state.recordLabel = label;
  state.gameCounted = false;
  saveSession();
}

function resetBoard(announce = true, message = "黑棋先手") {
  state.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  state.moves = [];
  state.turn = BLACK;
  state.winner = EMPTY;
  state.hover = null;
  state.gameCounted = false;
  state.message = message;
  hideResultModal();
  if (announce) send({ type: "reset", record: state.record });
  render();
  saveSession();
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

function finishGame(winner) {
  state.winner = winner;
  state.turn = winner === BLACK ? WHITE : BLACK;
  state.message = `${colorName(winner)}获胜`;
  if (!state.gameCounted) {
    state.record.total += 1;
    if (winner === BLACK) state.record.black += 1;
    if (winner === WHITE) state.record.white += 1;
    state.gameCounted = true;
  }
  showResultModal();
}

function placeStone(row, col, color, broadcast = true) {
  if (state.board[row][col] !== EMPTY || state.winner) return false;
  state.board[row][col] = color;
  state.moves.push({ row, col, color });

  if (checkWinner(row, col, color)) {
    finishGame(color);
  } else {
    state.turn = color === BLACK ? WHITE : BLACK;
    state.message = `轮到${colorName(state.turn)}`;
  }

  if (broadcast) send({ type: "move", row, col, color, record: state.record });
  render();
  saveSession();
  return true;
}

function updatePlayers() {
  blackPlayer.textContent = `黑棋：${state.players.black}`;
  whitePlayer.textContent = `白棋：${state.players.white}`;
}

function updateRecord() {
  recordSession.textContent = state.recordLabel;
  totalGames.textContent = state.record.total;
  blackWins.textContent = state.record.black;
  whiteWins.textContent = state.record.white;
  modalTotalGames.textContent = state.record.total;
  modalBlackWins.textContent = state.record.black;
  modalWhiteWins.textContent = state.record.white;
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

  state.moves.forEach((move, index) => drawStone(move.row, move.col, move.color, index === state.moves.length - 1));

  if (state.hover && canPlay() && state.board[state.hover.row][state.hover.col] === EMPTY) {
    drawGhost(state.hover.row, state.hover.col, state.turn);
  }
}

function showResultModal() {
  resultTitle.textContent = "本局结束";
  resultSummary.textContent = `${colorName(state.winner)}获胜，要再开一把吗？`;
  updateRecord();
  resultModal.hidden = false;
  saveSession();
}

function hideResultModal() {
  resultModal.hidden = true;
}

function render() {
  drawBoard();
  updatePlayers();
  updateRecord();
  updateMoveList();
  turnBadge.textContent = state.winner ? `${colorName(state.winner)}胜利` : `当前：${colorName(state.turn)}`;
  matchStatus.textContent = state.message;
}

function send(payload) {
  if (state.conn && state.conn.open) {
    state.conn.send({ ...payload, players: state.players, record: state.record, recordLabel: state.recordLabel });
  }
}

function handleRemoteLeave() {
  resetRoomRecord("玩家离开后已重置");
  resetBoard(false, "对方已退出，当前房间战绩已清零");
  state.players = { black: "等待", white: "等待" };
  state.mode = "idle";
  setStatus("玩家退出");
  render();
  saveSession();
}

function receive(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.players) state.players = payload.players;
  if (payload.record) state.record = payload.record;
  if (payload.recordLabel) state.recordLabel = payload.recordLabel;

  if (payload.type === "move") placeStone(payload.row, payload.col, payload.color, false);
  if (payload.type === "reset") resetBoard(false);
  if (payload.type === "undo") undoMove(false);
  if (payload.type === "leave") handleRemoteLeave();

  if (payload.type === "hello" && state.role === "black") {
    state.players.white = payload.name || "白棋玩家";
    state.message = "好友已加入，黑棋先手";
    send({
      type: "welcome",
      players: state.players,
      board: state.board,
      moves: state.moves,
      turn: state.turn,
      winner: state.winner,
      record: state.record,
      recordLabel: state.recordLabel,
    });
  }

  if (payload.type === "welcome") {
    state.players = payload.players || state.players;
    state.board = payload.board || state.board;
    state.moves = payload.moves || state.moves;
    state.turn = payload.turn || BLACK;
    state.winner = payload.winner || EMPTY;
    state.record = payload.record || state.record;
    state.recordLabel = payload.recordLabel || state.recordLabel;
    state.message = "已加入房间，等待黑棋落子";
    if (state.winner) showResultModal();
  }

  render();
  saveSession();
}

function connectEvents(conn) {
  state.conn = conn;
  conn.on("open", () => {
    state.mode = "online";
    setStatus("已连接", true);
    if (state.role === "white") conn.send({ type: "hello", name: ownName() });
    render();
    saveSession();
  });
  conn.on("data", receive);
  conn.on("close", () => {
    if (state.suppressCloseNotice) return;
    resetRoomRecord("玩家离开后已重置");
    resetBoard(false, "连接已断开，当前房间战绩已清零");
    setStatus("连接断开");
    state.mode = "idle";
    render();
    saveSession();
  });
  conn.on("error", () => setStatus("连接错误"));
}

function ensurePeer(onReady, requestedId = null) {
  if (!window.Peer) {
    setStatus("PeerJS 加载失败");
    state.message = "联机库加载失败，可先使用本地对战";
    render();
    return;
  }

  if (requestedId && state.peer && !state.peer.destroyed && state.peer.id !== requestedId) {
    state.peer.destroy();
    state.peer = null;
  }

  if (state.peer && !state.peer.destroyed) {
    onReady(state.peer);
    return;
  }

  const options = peerRuntimeConfig();
  const peer = requestedId ? new Peer(requestedId, options) : new Peer(undefined, options);
  state.peer = peer;
  setStatus("连接中");
  peer.on("open", () => onReady(peer));
  peer.on("error", (error) => {
    setStatus("信令不可用");
    if (error && error.type === "unavailable-id") {
      state.message = "这个房间码正在被占用，请稍后刷新或重新开房";
    } else {
      const usingCloud = options.host === DEFAULT_PEER_HOST;
      state.message = usingCloud
        ? "公共信令服务暂不可用，或当前网络无法连接 PeerJS Cloud。跨设备跨地区联机建议改用自建 PeerServer，并把 peerHost/peerPort/peerPath 参数带进房间链接。"
        : "当前自定义信令服务不可用，请检查 peerHost/peerPort/peerPath 和 TURN 参数。";
    }
    render();
  });
}

function updateShareLink(roomId) {
  roomInput.value = roomId;
  const url = new URL("gomoku.html", window.location.href);
  url.searchParams.set("room", roomId);
  applyPeerConfigToUrl(url);
  shareInput.value = url.toString();
}

function bindHostConnections(peer) {
  peer.on("connection", (conn) => {
    if (state.conn && state.conn.open) {
      conn.close();
      return;
    }
    connectEvents(conn);
  });
}

function hostRoom() {
  const name = ownName();
  const roomId = makeRoomId();
  nicknameInput.value = name;
  state.role = "black";
  state.mode = "online";
  state.roomId = roomId;
  state.players = { black: name, white: "等待加入" };
  resetRoomRecord("当前房间");
  updateShareLink(roomId);
  state.message = "房间已创建，等待好友加入";
  setStatus("等待加入", true);
  resetBoard(false, "黑棋先手");
  saveSession();

  ensurePeer((peer) => {
    bindHostConnections(peer);
  }, roomId);
}

function resumeHostedRoom(roomId) {
  ensurePeer((peer) => {
    state.role = "black";
    state.mode = "online";
    state.roomId = roomId;
    updateShareLink(roomId);
    state.message = state.winner ? state.message : "房间已恢复，等待好友重新连接";
    setStatus("房间已恢复", true);
    bindHostConnections(peer);
    if (state.winner) showResultModal();
    render();
    saveSession();
  }, roomId);
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
    state.roomId = roomId;
    state.players = { black: "房主", white: name };
    resetRoomRecord("当前房间");
    connectEvents(peer.connect(roomId, { reliable: true }));
    state.message = "正在加入房间";
    render();
    saveSession();
  });
}

function startLocal() {
  if (state.conn && state.conn.open) state.conn.close();
  if (state.peer && !state.peer.destroyed) state.peer.destroy();
  state.peer = null;
  state.conn = null;
  state.mode = "local";
  state.role = "both";
  state.roomId = "local";
  state.players = { black: "本地玩家 A", white: "本地玩家 B" };
  resetRoomRecord("本地房间");
  setStatus("本地对战", true);
  resetBoard(false, "本地对战已开始");
  saveSession();
}

function undoMove(broadcast = true) {
  if (!state.moves.length || state.winner) return;
  const move = state.moves.pop();
  state.board[move.row][move.col] = EMPTY;
  state.turn = move.color;
  state.message = `已悔棋，轮到${colorName(state.turn)}`;
  if (broadcast) send({ type: "undo" });
  render();
  saveSession();
}

function playAgain() {
  resetBoard(true, "再开一把，黑棋先手");
}

function exitToLobby() {
  state.suppressCloseNotice = true;
  send({ type: "leave" });
  if (state.conn && state.conn.open) state.conn.close();
  if (state.peer && !state.peer.destroyed) state.peer.destroy();
  clearSession();
  window.location.href = "index.html";
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
restartBtn.addEventListener("click", () => {
  resetRoomRecord(state.mode === "local" ? "本地房间" : "当前房间");
  resetBoard(true, "已重新开房，战绩已清零");
});
undoBtn.addEventListener("click", () => undoMove(true));
playAgainBtn.addEventListener("click", playAgain);
exitRoomBtn.addEventListener("click", exitToLobby);
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
    roomId: state.roomId,
    turn: colorName(state.turn),
    winner: state.winner ? colorName(state.winner) : null,
    players: state.players,
    record: state.record,
    recordLabel: state.recordLabel,
    modalOpen: !resultModal.hidden,
    moves: state.moves.map((move) => ({ row: move.row, col: move.col, color: colorName(move.color) })),
    message: state.message,
  });

window.advanceTime = () => {
  render();
};

function boot() {
  nicknameInput.value = localStorage.getItem("linkplay-name") || randomName();
  nicknameInput.addEventListener("change", () => localStorage.setItem("linkplay-name", nicknameInput.value.trim()));

  const roomFromUrl = new URLSearchParams(window.location.search).get("room");
  if (roomFromUrl) roomInput.value = roomFromUrl;

  const saved = loadSession();
  if (saved && (!roomFromUrl || saved.roomId === roomFromUrl || saved.mode === "local")) {
    state.restoring = true;
    applySession(saved);
    state.restoring = false;

    if (state.mode === "online" && state.role === "black" && state.roomId) {
      resumeHostedRoom(state.roomId);
      return;
    }

    if (state.mode === "online" && state.roomId) {
      updateShareLink(state.roomId);
      setStatus("等待重连", true);
    } else if (state.mode === "local") {
      setStatus("本地对战", true);
    }

    if (state.winner) showResultModal();
  }

  render();
}

boot();
