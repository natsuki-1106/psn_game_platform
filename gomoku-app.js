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
  record: { total: 0, players: {} },
  recordLabel: "新房间",
  gameCounted: false,
  undoRequest: null,
  undoLocks: { [BLACK]: false, [WHITE]: false },
  hostColor: BLACK,
  swapAfterGame: false,
  nextBlackColor: EMPTY,
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
    reconcileOnlineSeatNames(room);
    syncRoleFromSeat();
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

function colorKey(color) {
  return color === BLACK ? "black" : "white";
}

function oppositeColor(color) {
  return color === BLACK ? WHITE : BLACK;
}

function ownColor() {
  if (state.mode === "online") {
    if (roomApi?.isHost?.()) return state.hostColor;
    if (roomApi?.isGuest?.()) return oppositeColor(state.hostColor);
  }
  if (state.role === "black") return BLACK;
  if (state.role === "white") return WHITE;
  return EMPTY;
}

function syncRoleFromSeat() {
  const color = ownColor();
  if (color === BLACK) state.role = "black";
  if (color === WHITE) state.role = "white";
}

function reconcileOnlineSeatNames(room) {
  if (!room?.roomId) return;
  const hostKey = colorKey(state.hostColor);
  const guestKey = colorKey(oppositeColor(state.hostColor));
  if (room.role === "host") {
    const hostName = room.nickname || `${colorName(state.hostColor)}玩家`;
    const guestName = state.players[guestKey] && state.players[guestKey] !== "等待" ? state.players[guestKey] : "等待加入";
    state.players[hostKey] = hostName;
    state.players[guestKey] = guestName;
  } else {
    const guestColor = oppositeColor(state.hostColor);
    const guestName = room.nickname || `${colorName(guestColor)}玩家`;
    const hostName = state.players[hostKey] && state.players[hostKey] !== "等待" ? state.players[hostKey] : "房主";
    state.players[hostKey] = hostName;
    state.players[guestKey] = guestName;
  }
}

function cellLabel(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
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
  state.record = { total: 0, players: {} };
  state.recordLabel = label;
  state.gameCounted = false;
  state.nextBlackColor = EMPTY;
  state.swapAfterGame = false;
}

function normalizeRecord(record = state.record) {
  const normalized = {
    total: Number(record?.total) || 0,
    players: { ...(record?.players || {}) },
  };
  if (!record?.players) {
    if (record?.black) normalized.players[state.players.black] = (normalized.players[state.players.black] || 0) + record.black;
    if (record?.white) normalized.players[state.players.white] = (normalized.players[state.players.white] || 0) + record.white;
  }
  return normalized;
}

function playerNameForColor(color) {
  return state.players[colorKey(color)] || colorName(color);
}

function winsForPlayer(name) {
  return normalizeRecord().players[name] || 0;
}

function countWinForPlayer(color) {
  state.record = normalizeRecord();
  const name = playerNameForColor(color);
  state.record.players[name] = (state.record.players[name] || 0) + 1;
}

function hideResultModal() {
  resultModal.hidden = true;
}

function showResultModal() {
  resultModal.hidden = false;
  resultTitle.textContent = "本局结束";
  resultSummary.textContent = `${colorName(state.winner)}获胜，要再开一把吗？`;
  modalTotalGames.textContent = state.record.total;
  if (modalBlackWins.previousElementSibling) modalBlackWins.previousElementSibling.textContent = `${state.players.black}胜`;
  if (modalWhiteWins.previousElementSibling) modalWhiteWins.previousElementSibling.textContent = `${state.players.white}胜`;
  modalBlackWins.textContent = winsForPlayer(state.players.black);
  modalWhiteWins.textContent = winsForPlayer(state.players.white);
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
    undoLocks: state.undoLocks,
    hostColor: state.hostColor,
    swapAfterGame: state.swapAfterGame,
    nextBlackColor: state.nextBlackColor,
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
  state.record = normalizeRecord(snapshot.record || state.record);
  state.recordLabel = snapshot.recordLabel || state.recordLabel;
  state.gameCounted = Boolean(snapshot.gameCounted);
  state.undoRequest = snapshot.undoRequest || null;
  state.undoLocks = snapshot.undoLocks || { [BLACK]: false, [WHITE]: false };
  state.hostColor = snapshot.hostColor || BLACK;
  state.swapAfterGame = Boolean(snapshot.swapAfterGame);
  state.nextBlackColor = snapshot.nextBlackColor || EMPTY;
  syncRoleFromSeat();
  if (state.winner) showResultModal();
  else hideResultModal();
}

function broadcastSnapshot() {
  if (state.mode === "online" && roomApi?.hasRoom?.()) {
    roomApi.broadcast(roomSnapshot());
  }
}

function resetBoard(announce = true, message = "黑棋先手") {
  applyWinnerBlackRule();
  state.board = createBoard();
  state.moves = [];
  state.turn = BLACK;
  state.winner = EMPTY;
  state.hover = null;
  state.gameCounted = false;
  state.nextBlackColor = EMPTY;
  state.undoRequest = null;
  state.undoLocks = { [BLACK]: false, [WHITE]: false };
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
  state.hostColor = BLACK;
  state.swapAfterGame = false;
  state.nextBlackColor = EMPTY;
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

function applyWinnerBlackRule() {
  if (!state.nextBlackColor) return;
  if (state.nextBlackColor === WHITE) {
    state.hostColor = oppositeColor(state.hostColor);
    const black = state.players.black;
    state.players.black = state.players.white;
    state.players.white = black;
  }
  state.nextBlackColor = EMPTY;
  state.swapAfterGame = false;
  syncRoleFromSeat();
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
  const requesterColor = state.mode === "local" ? state.turn : myColor;
  const hasOwnMove = requesterColor ? state.moves.some((move) => move.color === requesterColor) : false;
  undoBtn.disabled =
    Boolean(request) ||
    state.winner ||
    !state.moves.length ||
    state.mode === "idle" ||
    !requesterColor ||
    !hasOwnMove ||
    Boolean(state.undoLocks[requesterColor]);
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
  if (blackWins.previousElementSibling) blackWins.previousElementSibling.textContent = `${state.players.black}胜`;
  if (whiteWins.previousElementSibling) whiteWins.previousElementSibling.textContent = `${state.players.white}胜`;
  if (modalBlackWins.previousElementSibling) modalBlackWins.previousElementSibling.textContent = `${state.players.black}胜`;
  if (modalWhiteWins.previousElementSibling) modalWhiteWins.previousElementSibling.textContent = `${state.players.white}胜`;
  blackWins.textContent = winsForPlayer(state.players.black);
  whiteWins.textContent = winsForPlayer(state.players.white);
  modalTotalGames.textContent = state.record.total;
  modalBlackWins.textContent = winsForPlayer(state.players.black);
  modalWhiteWins.textContent = winsForPlayer(state.players.white);
}

function updateMoves() {
  moveList.innerHTML = "";
  state.moves.forEach((move, index) => {
    const item = document.createElement("li");
    item.textContent = `${index + 1}. ${colorName(move.color)} (${cellLabel(move.row, move.col)})`;
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

  drawCoordinateLabels(pad, gap);

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

function drawCoordinateLabels(pad, gap) {
  ctx.fillStyle = "rgba(42, 28, 10, 0.78)";
  ctx.font = "700 16px Inter, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const x = pad + col * gap;
    const label = String.fromCharCode(65 + col);
    ctx.fillText(label, x, pad - 22);
    ctx.fillText(label, x, canvas.height - pad + 22);
  }
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const y = pad + row * gap;
    const label = String(row + 1);
    ctx.fillText(label, pad - 24, y);
    ctx.fillText(label, canvas.width - pad + 24, y);
  }
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
    state.record = normalizeRecord();
    state.record.total += 1;
    countWinForPlayer(color);
    state.gameCounted = true;
    state.nextBlackColor = color;
    state.swapAfterGame = true;
  }
  showResultModal();
}

function placeStone(row, col, color, shouldBroadcast = true) {
  if (state.board[row][col] !== EMPTY || state.winner || state.undoRequest) return false;
  state.board[row][col] = color;
  state.moves.push({ row, col, color, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  state.undoLocks[color] = false;
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

function removeMovesFrom(moveIndex) {
  const removed = state.moves.splice(moveIndex);
  if (!removed.length) return false;
  removed.forEach((move) => {
    state.board[move.row][move.col] = EMPTY;
  });
  const move = removed[0];
  if (!move) return false;
  state.turn = move.color;
  state.winner = EMPTY;
  state.message = `${colorName(move.color)}已悔一步，轮到${colorName(state.turn)}`;
  state.undoRequest = null;
  hideResultModal();
  return true;
}

function requestUndo() {
  if (!state.moves.length || state.winner || state.undoRequest) return;
  const requesterColor = state.mode === "local" ? state.turn : ownColor();
  if (!requesterColor) return;
  if (state.undoLocks[requesterColor]) {
    state.message = "每次落子后只能申请一次悔棋";
    render();
    return;
  }
  const moveIndex = state.moves.findLastIndex((move) => move.color === requesterColor);
  const move = state.moves[moveIndex];
  if (moveIndex < 0 || !move) {
    state.message = "只能申请悔自己刚下的最后一步";
    render();
    return;
  }

  if (state.mode === "local") {
    state.undoLocks[requesterColor] = true;
    removeMovesFrom(moveIndex);
    render();
    return;
  }

  state.undoLocks[requesterColor] = true;
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
      removeMovesFrom(request.moveIndex);
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
    undoLocks: state.undoLocks,
    hostColor: colorName(state.hostColor),
    swapAfterGame: state.swapAfterGame,
    nextBlackColor: state.nextBlackColor ? colorName(state.nextBlackColor) : null,
    moves: state.moves.map((move) => ({ row: move.row, col: move.col, point: cellLabel(move.row, move.col), color: colorName(move.color), id: move.id || null })),
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
