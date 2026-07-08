const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const STORAGE_KEY = "linkplay-gomoku-session-v2";
const CONNECT_TIMEOUT_MS = 12000;
const MAX_CONNECT_ATTEMPTS = 3;

const canvas = document.querySelector("#boardCanvas");
const ctx = canvas.getContext("2d");
const nicknameInput = document.querySelector("#nicknameInput");
const roomInput = document.querySelector("#roomInput");
const shareInput = document.querySelector("#shareInput");
const hostBtn = document.querySelector("#hostBtn");
const joinBtn = document.querySelector("#joinBtn");
const localBtn = document.querySelector("#localBtn");
const leaveRoomBtn = document.querySelector("#leaveRoomBtn");
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

const supabaseConfig = window.LINKPLAY_SUPABASE || {};

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
  message: "创建或加入房间开始对战",
  record: { total: 0, black: 0, white: 0 },
  recordLabel: "新房间",
  gameCounted: false,
  restoring: false,
  suppressCloseNotice: false,
  connectAttempt: 0,
  transport: {
    kind: "none",
    sessionId: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    client: null,
    channel: null,
    peerOpen: false,
    connOpen: false,
    guestId: "",
    guestName: "",
  },
};

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function hasSupabaseConfig() {
  return Boolean(window.supabase?.createClient && supabaseConfig.url && supabaseConfig.anonKey);
}

function colorName(color) {
  return color === BLACK ? "黑棋" : "白棋";
}

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

function normalizeRoomId(value) {
  const roomId = (value || "").trim();
  if (!roomId) return "";
  if (/^ip-/i.test(roomId)) return `lp-${roomId.slice(3)}`.toLowerCase();
  if (/^lp-/i.test(roomId)) return roomId.toLowerCase();
  return roomId;
}

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function setStatus(text, connected = false) {
  connectionStatus.textContent = text;
  connectionStatus.style.color = connected ? "var(--accent)" : "var(--warn)";
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
  state.board = saved.board || createBoard();
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

function hideResultModal() {
  resultModal.hidden = true;
}

function showResultModal() {
  resultModal.hidden = false;
  const winnerName = colorName(state.winner);
  resultTitle.textContent = "本局结束";
  resultSummary.textContent = `${winnerName}获胜，要再开一把吗？`;
  modalTotalGames.textContent = state.record.total;
  modalBlackWins.textContent = state.record.black;
  modalWhiteWins.textContent = state.record.white;
}

function resetBoard(announce = true, message = "黑棋先手") {
  state.board = createBoard();
  state.moves = [];
  state.turn = BLACK;
  state.winner = EMPTY;
  state.hover = null;
  state.gameCounted = false;
  state.message = message;
  hideResultModal();
  if (announce) broadcast({ type: "reset", snapshot: roomSnapshot() });
  render();
  saveSession();
}

function updateShareLink(roomId) {
  roomInput.value = roomId;
  const url = new URL("gomoku.html", window.location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set("transport", "supabase");
  shareInput.value = url.toString();
}

function roomSnapshot() {
  return {
    board: state.board,
    moves: state.moves,
    turn: state.turn,
    winner: state.winner,
    players: state.players,
    record: state.record,
    recordLabel: state.recordLabel,
    message: state.message,
    gameCounted: state.gameCounted,
  };
}

function applyRoomSnapshot(snapshot) {
  if (!snapshot) return;
  state.board = snapshot.board || createBoard();
  state.moves = snapshot.moves || [];
  state.turn = snapshot.turn || BLACK;
  state.winner = snapshot.winner || EMPTY;
  state.players = snapshot.players || state.players;
  state.record = snapshot.record || state.record;
  state.recordLabel = snapshot.recordLabel || state.recordLabel;
  state.message = snapshot.message || state.message;
  state.gameCounted = Boolean(snapshot.gameCounted);
  if (state.winner) showResultModal();
  else hideResultModal();
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
  turnBadge.textContent = state.winner ? `${colorName(state.winner)}获胜` : `${colorName(state.turn)}回合`;
  matchStatus.textContent = state.message;
  updateRoomControls();
}

function render() {
  renderBoard();
  renderStatus();
}

function isGithubPages() {
  return /\.github\.io$/i.test(window.location.hostname);
}

function updateRoomControls() {
  const inRoom = state.mode !== "idle";
  if (hostBtn) hostBtn.hidden = inRoom;
  if (joinBtn) joinBtn.hidden = inRoom;
  if (localBtn) localBtn.hidden = inRoom;
  if (leaveRoomBtn) leaveRoomBtn.hidden = !inRoom;
  if (roomInput) roomInput.disabled = inRoom;
  if (nicknameInput) nicknameInput.disabled = inRoom;
  if (restartBtn) restartBtn.hidden = isGithubPages();
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

function placeStone(row, col, color, broadcastMove = true) {
  if (state.board[row][col] !== EMPTY || state.winner) return false;
  state.board[row][col] = color;
  state.moves.push({ row, col, color });
  if (checkWinner(row, col, color)) {
    finishGame(color);
  } else {
    state.turn = color === BLACK ? WHITE : BLACK;
    state.message = `轮到${colorName(state.turn)}`;
  }
  if (broadcastMove) broadcast({ type: "move", row, col, color });
  render();
  saveSession();
  return true;
}

function undoMove(broadcastMove = true) {
  if (!state.moves.length || state.winner) return;
  const move = state.moves.pop();
  state.board[move.row][move.col] = EMPTY;
  state.turn = move.color;
  state.message = `已悔棋，轮到${colorName(state.turn)}`;
  if (broadcastMove) broadcast({ type: "undo" });
  render();
  saveSession();
}

function playAgain() {
  resetBoard(true, "再开一把，黑棋先手");
}

function handleRemoteLeave() {
  resetRoomRecord("玩家离开后已重置");
  resetBoard(false, "对方已退出，当前房间战绩已清零");
  state.players = { black: "等待", white: "等待" };
  state.mode = "idle";
  state.transport.connOpen = false;
  setStatus("玩家退出");
  render();
  saveSession();
}

function closeTransport() {
  clearConnectTimer();
  if (state.transport.channel) {
    state.transport.channel.unsubscribe();
  }
  state.transport.channel = null;
  state.transport.client = null;
  state.transport.peerOpen = false;
  state.transport.connOpen = false;
  state.transport.guestId = "";
  state.transport.guestName = "";
}

function resetToIdle(message = "已退出房间") {
  closeTransport();
  clearSession();
  state.board = createBoard();
  state.moves = [];
  state.turn = BLACK;
  state.winner = EMPTY;
  state.mode = "idle";
  state.role = "spectator";
  state.roomId = "";
  state.players = { black: "等待", white: "等待" };
  state.hover = null;
  state.message = message;
  state.record = { total: 0, black: 0, white: 0 };
  state.recordLabel = "新房间";
  state.gameCounted = false;
  state.connectAttempt = 0;
  roomInput.disabled = false;
  nicknameInput.disabled = false;
  shareInput.value = "";
  hideResultModal();
  setStatus("未连接");
  history.replaceState(null, "", "gomoku.html");
  render();
}

function ensureSupabaseClient() {
  if (state.transport.client) return state.transport.client;
  if (!hasSupabaseConfig()) return null;
  state.transport.client = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return state.transport.client;
}

function clearConnectTimer() {
  if (state.connectTimer) {
    clearTimeout(state.connectTimer);
    state.connectTimer = null;
  }
}

function beginJoinTimeout(roomId) {
  clearConnectTimer();
  state.connectTimer = setTimeout(() => {
    if (state.role !== "white" || state.roomId !== roomId || state.transport.connOpen) return;
    if (state.connectAttempt < MAX_CONNECT_ATTEMPTS) {
      state.connectAttempt += 1;
      state.message = `连接房主超时，正在重试 (${state.connectAttempt}/${MAX_CONNECT_ATTEMPTS})`;
      render();
      sendTransport({ type: "hello", name: ownName() });
      beginJoinTimeout(roomId);
      return;
    }
    setStatus("未连上房主");
    state.message = "Supabase 房间未收到房主同步，请确认已在 config.js 配置好 Supabase，并让房主重新创建房间后分享完整链接。";
    render();
  }, CONNECT_TIMEOUT_MS);
}

async function sendTransport(payload) {
  if (!state.transport.channel) return;
  await state.transport.channel.send({
    type: "broadcast",
    event: "gomoku",
    payload: { ...payload, senderId: state.transport.sessionId, roomId: state.roomId },
  });
}

function receiveTransport(payload) {
  if (!payload || payload.senderId === state.transport.sessionId) return;
  if (payload.roomId !== state.roomId) return;

  if (payload.type === "hello" && state.role === "black") {
    state.transport.connOpen = true;
    state.transport.guestId = payload.senderId;
    state.transport.guestName = payload.name || "白棋玩家";
    state.players.white = state.transport.guestName;
    state.message = "好友已加入，黑棋先手";
    setStatus("已连接", true);
    render();
    saveSession();
    sendTransport({
      type: "sync",
      targetId: payload.senderId,
      snapshot: roomSnapshot(),
      players: state.players,
    });
    return;
  }

  if (payload.targetId && payload.targetId !== state.transport.sessionId) return;

  if (payload.type === "sync") {
    clearConnectTimer();
    state.connectAttempt = 0;
    state.transport.connOpen = true;
    state.players = payload.players || state.players;
    applyRoomSnapshot(payload.snapshot);
    state.message = state.winner ? state.message : "已加入房间，等待黑棋落子";
    setStatus("已连接", true);
    render();
    saveSession();
    return;
  }

  if (!state.transport.connOpen) {
    state.transport.connOpen = true;
    setStatus("已连接", true);
  }

  if (payload.type === "move") placeStone(payload.row, payload.col, payload.color, false);
  if (payload.type === "reset") {
    applyRoomSnapshot(payload.snapshot);
    render();
    saveSession();
  }
  if (payload.type === "undo") undoMove(false);
  if (payload.type === "leave") handleRemoteLeave();
}

async function connectSupabase(role, roomId) {
  closeTransport();
  const client = ensureSupabaseClient();
  if (!client) {
    state.transport.kind = "none";
    state.transport.peerOpen = false;
    state.transport.connOpen = false;
    state.message = "未配置 Supabase。请在 config.js 中填写 SUPABASE_URL 和 SUPABASE_ANON_KEY 后再测试跨设备联机。";
    setStatus("需配置 Supabase");
    render();
    return false;
  }

  state.transport.kind = "supabase";
  state.transport.channel = client.channel(`gomoku:${roomId}`, {
    config: { broadcast: { self: false, ack: false } },
  });
  state.transport.channel.on("broadcast", { event: "gomoku" }, ({ payload }) => receiveTransport(payload));

  return new Promise((resolve) => {
    state.transport.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        state.transport.peerOpen = true;
        if (role === "black") {
          state.message = "房间已上线，等待好友加入";
          setStatus("等待加入", true);
        } else {
          state.message = "正在加入房间";
          setStatus("连接中");
          beginJoinTimeout(roomId);
          sendTransport({ type: "hello", name: ownName() });
        }
        render();
        saveSession();
        resolve(true);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        state.transport.peerOpen = false;
        state.transport.connOpen = false;
        setStatus("连接错误");
        state.message = "Supabase 实时频道连接失败，请检查 config.js 里的 URL / anon key。";
        render();
        resolve(false);
      }
    });
  });
}

function broadcast(payload) {
  if (state.mode !== "online") return;
  if (state.transport.kind === "supabase") {
    const enriched = payload.snapshot ? payload : { ...payload, snapshot: roomSnapshot() };
    sendTransport(enriched);
  }
}

async function hostRoom() {
  const name = ownName();
  const roomId = makeRoomId();
  nicknameInput.value = name;
  state.role = "black";
  state.mode = "online";
  state.roomId = roomId;
  state.players = { black: name, white: "等待加入" };
  state.connectAttempt = 0;
  resetRoomRecord("当前房间");
  updateShareLink(roomId);
  state.message = "正在连接房间服务";
  setStatus("房间上线中");
  resetBoard(false, "黑棋先手");
  render();
  saveSession();
  await connectSupabase("black", roomId);
}

async function resumeHostedRoom(roomId) {
  state.role = "black";
  state.mode = "online";
  state.roomId = roomId;
  updateShareLink(roomId);
  await connectSupabase("black", roomId);
}

async function joinRoom() {
  const roomId = normalizeRoomId(roomInput.value);
  if (!roomId) {
    state.message = "请输入房间码";
    render();
    return;
  }
  roomInput.value = roomId;
  nicknameInput.value = ownName();
  clearConnectTimer();
  state.connectAttempt = 0;
  state.role = "white";
  state.mode = "online";
  state.roomId = roomId;
  state.players = { black: "房主", white: ownName() };
  resetRoomRecord("当前房间");
  state.message = "正在加入房间";
  render();
  saveSession();
  await connectSupabase("white", roomId);
}

function startLocal() {
  closeTransport();
  state.mode = "local";
  state.role = "both";
  state.roomId = "local";
  state.players = { black: "本地玩家 A", white: "本地玩家 B" };
  resetRoomRecord("本地房间");
  setStatus("本地对战", true);
  resetBoard(false, "本地对战已开始");
  render();
  saveSession();
}

function exitToLobby() {
  state.suppressCloseNotice = true;
  broadcast({ type: "leave" });
  closeTransport();
  clearSession();
  window.location.href = "index.html";
}

function leaveCurrentRoom() {
  state.suppressCloseNotice = true;
  broadcast({ type: "leave" });
  resetToIdle("已退出房间，可以重新创建或加入房间");
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
leaveRoomBtn.addEventListener("click", leaveCurrentRoom);
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
    connectionStatus: connectionStatus.textContent,
    peerId: state.transport.sessionId,
    peerOpen: state.transport.peerOpen,
    connOpen: state.transport.connOpen,
    connectAttempt: state.connectAttempt,
    transportKind: state.transport.kind,
    supabaseConfigured: hasSupabaseConfig(),
  });

window.advanceTime = () => render();

async function boot() {
  nicknameInput.value = localStorage.getItem("linkplay-name") || randomName();
  nicknameInput.addEventListener("change", () => localStorage.setItem("linkplay-name", nicknameInput.value.trim()));

  const roomFromUrl = normalizeRoomId(currentParams().get("room"));
  if (roomFromUrl) roomInput.value = roomFromUrl;

  const saved = loadSession();
  if (saved && (!roomFromUrl || saved.roomId === roomFromUrl || saved.mode === "local")) {
    state.restoring = true;
    applySession(saved);
    state.restoring = false;

    if (state.mode === "online" && state.role === "black" && state.roomId) {
      await resumeHostedRoom(state.roomId);
      render();
      return;
    }

    if (state.mode === "online" && state.role === "white" && state.roomId) {
      await joinRoom();
      return;
    }

    if (state.mode === "local") {
      setStatus("本地对战", true);
    }
    if (state.winner) showResultModal();
  } else if (roomFromUrl) {
    clearSession();
    roomInput.value = roomFromUrl;
    state.message = "正在通过房间链接加入";
    render();
    await joinRoom();
    return;
  }

  render();
}

boot();
