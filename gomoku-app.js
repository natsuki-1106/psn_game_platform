const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const canvas = document.querySelector("#boardCanvas");
const ctx = canvas.getContext("2d");
const roomInput = document.querySelector("#roomInput");
const localBtn = document.querySelector("#localBtn");
const restartBtn = document.querySelector("#restartBtn");
const undoBtn = document.querySelector("#undoBtn");
const approveUndoBtn = document.querySelector("#approveUndoBtn");
const rejectUndoBtn = document.querySelector("#rejectUndoBtn");
const undoRequestPanel = document.querySelector("#undoRequestPanel");
const undoRequestText = document.querySelector("#undoRequestText");
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
  board: createBoard(),
  moves: [],
  turn: BLACK,
  winner: EMPTY,
  mode: "idle",
  role: "spectator",
  roomId: "",
  players: { black: "等待", white: "等待" },
  hover: null,
  message: "创建房间或加入房间开始对局",
  record: { total: 0, black: 0, white: 0 },
  recordLabel: "新房间",
  gameCounted: false,
  undoRequest: null,
  room: null,
};

let roomApi = null;

roomApi = window.initRoomPanel({
  gameKey: "gomoku",
  prefix: "WZ",
  getSnapshot: () => roomSnapshot(),
  onRemoteState(snapshot) {
    applyRoomSnapshot(snapshot);
    render();
  },
  onRoomChange(room) {
    state.room = room;
    if (!room.roomId) {
      state.mode = state.mode === "local" ? "local" : "idle";
      state.role = state.mode === "local" ? "both" : "spectator";
      state.roomId = state.mode === "local" ? "local" : "";
      if (state.mode !== "local") {
        state.players = { black: "等待", white: "等待" };
        state.message = "创建房间或加入房间开始对局";
      }
      render();
      return;
    }

    state.mode = "online";
    state.role = room.role === "host" ? "black" : "white";
    state.roomId = room.roomId;
    if (room.role === "host") {
      state.players.black = room.nickname || "黑棋玩家";
      if (!state.players.white || state.players.white === "等待") state.players.white = "等待加入";
      if (!state.moves.length && !state.winner) state.message = "房间已上线，等待好友加入";
    } else {
      state.players.white = room.nickname || "白棋玩家";
      if (!state.players.black || state.players.black === "等待") state.players.black = "房主";
      if (!state.moves.length && !state.winner) state.message = "已加入房间，等待黑棋落子";
    }
    setStatus(room.online === "online" ? (room.role === "host" ? "等待加入" : "已加入") : "连接中", room.online !== "error");
    updateRoomControls();
    render();
  },
});

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function colorName(color) {
  return color === BLACK ? "黑棋" : "白棋";
}

function ownColor() {
  if (state.role === "black") return BLACK;
  if (state.role === "white") return WHITE;
  return EMPTY;
}

function setStatus(text, connected = false) {
  connectionStatus.textContent = text;
  connectionStatus.style.color = connected ? "var(--accent)" : "var(--warn)";
}

function isGithubPages() {
  return /\.github\.io$/i.test(window.location.hostname);
}

function hasSupabaseConfig() {
  const config = window.LINKPLAY_SUPABASE || {};
  return Boolean(window.supabase?.createClient && config.url && config.anonKey);
}

function resetRoomRecord(label = "新房间") {
  state.record = { total: 0, black: 0, white: 0 };
  state.recordLabel = label;
  state.gameCounted = false;
}

function hideResultModal() {
  resultModal.hidden = true;
}

function showResultModal() {
  resultModal.hidden = false;
  resultTitle.textContent = "本局结束";
  resultSummary.textContent = `${colorName(state.winner)}获胜，要再开一把吗？`;
  modalTotalGames.textContent = state.record.total;
  modalBlackWins.textContent = state.record.black;
  modalWhiteWins.textContent = state.record.white;
}

function roomSnapshot() {
  return {
    board: state.board,
    moves: state.moves,
    turn: state.turn,
    winner: state.winner,
    players: state.players,
    message: state.message,
    record: state.record,
    recordLabel: state.recordLabel,
    gameCounted: state.gameCounted,
    undoRequest: state.undoRequest,
  };
}

function applyRoomSnapshot(snapshot) {
  if (!snapshot) return;
  state.board = snapshot.board || createBoard();
  state.moves = snapshot.moves || [];
  state.turn = snapshot.turn || BLACK;
  state.winner = snapshot.winner || EMPTY;
  state.players = snapshot.players || state.players;
  state.message = snapshot.message || state.message;
  state.record = snapshot.record || state.record;
  state.recordLabel = snapshot.recordLabel || state.recordLabel;
  state.gameCounted = Boolean(snapshot.gameCounted);
  state.undoRequest = snapshot.undoRequest || null;
  if (state.winner) showResultModal();
  else hideResultModal();
}

function broadcastSnapshot() {
  if (state.mode === "online" && roomApi?.hasRoom?.()) {
    roomApi.broadcast(roomSnapshot());
  }
}

function resetBoard(announce = true, message = "黑棋先手") {
  state.board = createBoard();
  state.moves = [];
  state.turn = BLACK;
  state.winner = EMPTY;
  state.hover = null;
  state.gameCounted = false;
  state.undoRequest = null;
  state.message = message;
  hideResultModal();
  render();
  if (announce) broadcastSnapshot();
}

function startLocal() {
  roomApi?.leaveRoom?.();
  state.mode = "local";
  state.role = "both";
  state.roomId = "local";
  state.players = { black: "本地玩家 A", white: "本地玩家 B" };
  resetRoomRecord("本地房间");
  setStatus("本地对战", true);
  resetBoard(false, "本地对战已开始");
  render();
}

function updateRoomControls() {
  const inOnlineRoom = state.mode === "online" && Boolean(state.roomId);
  if (localBtn) localBtn.hidden = inOnlineRoom;
  if (restartBtn) restartBtn.hidden = isGithubPages();
}

function updateUndoPanel() {
  const request = state.undoRequest;
  const myColor = ownColor();
  const shouldReview = request && state.mode === "online" && request.requesterColor !== myColor;
  undoRequestPanel.hidden = !shouldReview;
  if (shouldReview) {
    undoRequestText.textContent = `${colorName(request.requesterColor)}请求悔一步`;
  }
  const ownPending = request && request.requesterColor === myColor;
  undoBtn.disabled = Boolean(request) || state.winner || !state.moves.length || state.mode === "idle";
  if (ownPending) {
    undoBtn.textContent = "等待对方同意";
  } else {
    undoBtn.textContent = "悔棋";
  }
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

function updateMoves() {
  moveList.innerHTML = "";
  state.moves.forEach((move, index) => {
    const item = document.createElement("li");
    item.textContent = `${index + 1}. ${colorName(move.color)} (${move.row + 1}, ${move.col + 1})`;
    moveList.appendChild(item);
  });
}

function renderBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#d8b577";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 42;
  const gap = (canvas.width - pad * 2) / (BOARD_SIZE - 1);

  ctx.strokeStyle = "rgba(36, 25, 9, 0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const pos = pad + gap * i;
    ctx.beginPath();
    ctx.moveTo(pad, pos);
    ctx.lineTo(canvas.width - pad, pos);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pos, pad);
    ctx.lineTo(pos, canvas.height - pad);
    ctx.stroke();
  }

  [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].forEach(([row, col]) => {
    ctx.beginPath();
    ctx.fillStyle = "#2a1b08";
    ctx.arc(pad + col * gap, pad + row * gap, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (state.hover && !state.winner && state.board[state.hover.row][state.hover.col] === EMPTY && canPlay()) {
    const { row, col } = state.hover;
    ctx.beginPath();
    ctx.fillStyle = state.turn === BLACK ? "rgba(35, 35, 35, 0.25)" : "rgba(245, 245, 245, 0.75)";
    ctx.arc(pad + col * gap, pad + row * gap, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  state.moves.forEach((move, index) => {
    const x = pad + move.col * gap;
    const y = pad + move.row * gap;
    ctx.beginPath();
    ctx.fillStyle = move.color === BLACK ? "#1f1f1f" : "#f5f2eb";
    ctx.strokeStyle = move.color === BLACK ? "#111" : "#bbb";
    ctx.lineWidth = 1.5;
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (index === state.moves.length - 1) {
      ctx.beginPath();
      ctx.strokeStyle = move.color === BLACK ? "#f7df73" : "#5d4037";
      ctx.lineWidth = 3;
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function renderStatus() {
  updatePlayers();
  updateRecord();
  updateMoves();
  updateUndoPanel();
  turnBadge.textContent = state.winner ? `${colorName(state.winner)}获胜` : `${colorName(state.turn)}回合`;
  matchStatus.textContent = state.message;
  updateRoomControls();
}

function render() {
  renderBoard();
  renderStatus();
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
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  const x = pad + col * gap;
  const y = pad + row * gap;
  if (Math.hypot(point.x - x, point.y - y) > gap * 0.45) return null;
  return { row, col };
}

function canPlay() {
  if (state.winner || state.undoRequest) return false;
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
  return (
    countDirection(row, col, 0, 1, color) + countDirection(row, col, 0, -1, color) + 1 >= 5 ||
    countDirection(row, col, 1, 0, color) + countDirection(row, col, -1, 0, color) + 1 >= 5 ||
    countDirection(row, col, 1, 1, color) + countDirection(row, col, -1, -1, color) + 1 >= 5 ||
    countDirection(row, col, 1, -1, color) + countDirection(row, col, -1, 1, color) + 1 >= 5
  );
}

function finishGame(color) {
  state.winner = color;
  state.message = `${colorName(color)}获胜`;
  if (!state.gameCounted) {
    state.record.total += 1;
    if (color === BLACK) state.record.black += 1;
    if (color === WHITE) state.record.white += 1;
    state.gameCounted = true;
  }
  showResultModal();
}

function placeStone(row, col, color, shouldBroadcast = true) {
  if (state.board[row][col] !== EMPTY || state.winner || state.undoRequest) return false;
  state.board[row][col] = color;
  state.moves.push({ row, col, color, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  if (checkWinner(row, col, color)) {
    finishGame(color);
  } else {
    state.turn = color === BLACK ? WHITE : BLACK;
    state.message = `轮到${colorName(state.turn)}`;
  }
  render();
  if (shouldBroadcast) broadcastSnapshot();
  return true;
}

function removeMove(moveIndex) {
  const [move] = state.moves.splice(moveIndex, 1);
  if (!move) return false;
  state.board[move.row][move.col] = EMPTY;
  state.turn = move.color;
  state.winner = EMPTY;
  state.message = `${colorName(move.color)}已悔一步，轮到${colorName(state.turn)}`;
  state.undoRequest = null;
  hideResultModal();
  return true;
}

function requestUndo() {
  if (!state.moves.length || state.winner || state.undoRequest) return;
  const requesterColor = state.mode === "local" ? state.moves.at(-1).color : ownColor();
  const moveIndex = state.moves.length - 1;
  const move = state.moves[moveIndex];
  if (!move || move.color !== requesterColor) {
    state.message = "只能申请悔自己刚下的最后一步";
    render();
    return;
  }

  if (state.mode === "local") {
    removeMove(moveIndex);
    render();
    return;
  }

  state.undoRequest = {
    requesterColor,
    moveIndex,
    moveId: move.id || `${move.row}-${move.col}-${move.color}-${moveIndex}`,
    createdAt: Date.now(),
  };
  state.message = `${colorName(requesterColor)}请求悔一步，等待对方同意`;
  render();
  broadcastSnapshot();
}

function resolveUndoRequest(approved) {
  const request = state.undoRequest;
  if (!request) return;
  const reviewerColor = ownColor();
  if (state.mode === "online" && request.requesterColor === reviewerColor) return;

  if (approved) {
    const move = state.moves[request.moveIndex];
    if (move && move.color === request.requesterColor) {
      removeMove(request.moveIndex);
    } else {
      state.undoRequest = null;
      state.message = "悔棋失败，棋局已变化";
    }
  } else {
    state.message = `${colorName(reviewerColor)}拒绝悔棋`;
    state.undoRequest = null;
  }
  render();
  broadcastSnapshot();
}

function playAgain() {
  resetBoard(true, "再开一把，黑棋先手");
}

function exitToLobby() {
  roomApi?.leaveRoom?.();
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
    state.message = state.undoRequest ? "悔棋申请处理中，暂不能落子" : state.winner ? `${colorName(state.winner)}已获胜` : "还没轮到你落子";
    render();
    return;
  }
  placeStone(cell.row, cell.col, state.turn);
});

localBtn.addEventListener("click", startLocal);
restartBtn.addEventListener("click", () => {
  resetRoomRecord(state.mode === "local" ? "本地房间" : "当前房间");
  resetBoard(true, "已重新开局，战绩已清零");
});
undoBtn.addEventListener("click", requestUndo);
approveUndoBtn.addEventListener("click", () => resolveUndoRequest(true));
rejectUndoBtn.addEventListener("click", () => resolveUndoRequest(false));
playAgainBtn.addEventListener("click", playAgain);
exitRoomBtn.addEventListener("click", exitToLobby);

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
    undoRequest: state.undoRequest,
    moves: state.moves.map((move) => ({ row: move.row, col: move.col, color: colorName(move.color), id: move.id || null })),
    message: state.message,
    connectionStatus: connectionStatus.textContent,
    peerId: roomApi?.state?.sessionId || "",
    peerOpen: roomApi?.state?.online === "online",
    connOpen: roomApi?.connectionCount?.() > 0,
    connectAttempt: 0,
    transportKind: "shared-supabase",
    supabaseConfigured: hasSupabaseConfig(),
  });

window.advanceTime = () => render();

if (roomInput.value.trim()) {
  state.message = "正在通过房间链接加入";
}

render();
