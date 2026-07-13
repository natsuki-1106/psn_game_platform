(function () {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
    [-1, 0],
    [0, -1],
    [-1, -1],
    [-1, 1],
  ];

  const configs = {
    tictactoe: {
      key: "tictactoe",
      prefix: "JZ",
      title: "井字棋",
      rows: 3,
      cols: 3,
      labels: { black: "先手", white: "后手" },
      startMessage: "先手落子",
      bg: "#f1c978",
    },
    reversi: {
      key: "reversi",
      prefix: "HB",
      title: "黑白棋",
      rows: 8,
      cols: 8,
      labels: { black: "黑棋", white: "白棋" },
      startMessage: "黑棋先手，浅色提示点可落子",
      bg: "#d9ae72",
    },
    connect4: {
      key: "connect4",
      prefix: "SZ",
      title: "四子棋",
      rows: 6,
      cols: 7,
      labels: { black: "红方", white: "黄方" },
      startMessage: "红方先手，点击列落子",
      bg: "#1d5fab",
    },
  };

  const gameKey = document.body.dataset.gridGame;
  const config = configs[gameKey];
  if (!config) return;

  const canvas = document.querySelector("#boardCanvas");
  const ctx = canvas.getContext("2d");
  const localBtn = document.querySelector("#localBtn");
  const startBtn = document.querySelector("#startBtn");
  const restartBtn = document.querySelector("#restartBtn");
  const undoBtn = document.querySelector("#undoBtn");
  const undoModeField = document.querySelector("#undoModeField");
  const undoModeSelect = document.querySelector("#undoModeSelect");
  const roomStatus = document.querySelector("#roomStatus");
  const turnBadge = document.querySelector("#turnBadge");
  const matchStatus = document.querySelector("#matchStatus");
  const blackPlayer = document.querySelector("#blackPlayer");
  const whitePlayer = document.querySelector("#whitePlayer");
  const blackPieceCount = document.querySelector("#blackPieceCount");
  const whitePieceCount = document.querySelector("#whitePieceCount");
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
    draw: false,
    started: false,
    mode: "idle",
    role: "spectator",
    roomId: "",
    players: { black: "等待", white: "等待" },
    record: { total: 0, players: {}, draw: 0 },
    recordLabel: "新房间",
    gameCounted: false,
    hostColor: BLACK,
    swapAfterGame: false,
    nextBlackColor: EMPTY,
    undoMode: "no-undo",
    timers: { black: 0, white: 0 },
    turnStartedAt: null,
    message: "创建房间、加入房间或本地对战后开始",
    legalMoves: [],
    room: null,
  };

  let roomApi = null;
  let renderTicker = null;

  function selectedUndoMode() {
    return undoModeSelect?.value === "undo" ? "undo" : "no-undo";
  }

  roomApi = window.initRoomPanel({
    gameKey: config.key,
    prefix: config.prefix,
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
          state.started = false;
          state.message = "创建房间、加入房间或本地对战后开始";
        }
        render();
        return;
      }

      state.mode = "online";
      state.roomId = room.roomId;
      if (config.key === "reversi" && room.role === "host" && !state.started) {
        state.undoMode = selectedUndoMode();
      }
      if (room.role === "host") {
        state.players.black = room.nickname || `${config.labels.black}玩家`;
        if (!state.players.white || state.players.white === "等待") state.players.white = "等待加入";
        if (!state.started) state.message = "房间已创建，房主点击开始后开局";
      } else {
        state.players.white = room.nickname || `${config.labels.white}玩家`;
        if (!state.players.black || state.players.black === "等待") state.players.black = "房主";
        if (!state.started) state.message = "已加入房间，等待房主开始";
      }
      roomStatus.textContent = room.online === "online" ? `房间 ${room.roomId}` : "连接中";
      reconcileOnlineSeatNames(room);
      syncRoleFromSeat();
      updateRoomControls();
      render();
    },
  });

  function createBoard() {
    return Array.from({ length: config.rows }, () => Array(config.cols).fill(EMPTY));
  }

  function colorName(color) {
    return color === BLACK ? config.labels.black : config.labels.white;
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
      const hostName = room.nickname || `${config.labels[hostKey]}鐜╁`;
      const guestName = state.players[guestKey] && state.players[guestKey] !== "绛夊緟" ? state.players[guestKey] : "绛夊緟鍔犲叆";
      state.players[hostKey] = hostName;
      state.players[guestKey] = guestName;
    } else {
      const guestName = room.nickname || `${config.labels[guestKey]}鐜╁`;
      const hostName = state.players[hostKey] && state.players[hostKey] !== "绛夊緟" ? state.players[hostKey] : "鎴夸富";
      state.players[hostKey] = hostName;
      state.players[guestKey] = guestName;
    }
  }

  function roomSnapshot() {
    return {
      board: state.board,
      moves: state.moves,
      turn: state.turn,
      winner: state.winner,
      draw: state.draw,
      started: state.started,
      players: state.players,
      record: state.record,
      recordLabel: state.recordLabel,
      gameCounted: state.gameCounted,
      hostColor: state.hostColor,
      swapAfterGame: state.swapAfterGame,
      nextBlackColor: state.nextBlackColor,
      undoMode: state.undoMode,
      timers: elapsedTimers(),
      turnStartedAt: isReversiClockRunning() ? Date.now() : null,
      message: state.message,
    };
  }

  function applyRoomSnapshot(snapshot) {
    if (!snapshot) return;
    state.board = snapshot.board || createBoard();
    state.moves = snapshot.moves || [];
    state.turn = snapshot.turn || BLACK;
    state.winner = snapshot.winner || EMPTY;
    state.draw = Boolean(snapshot.draw);
    state.started = Boolean(snapshot.started);
    state.players = snapshot.players || state.players;
    state.record = normalizeRecord(snapshot.record || state.record);
    state.recordLabel = snapshot.recordLabel || state.recordLabel;
    state.gameCounted = Boolean(snapshot.gameCounted);
    state.hostColor = snapshot.hostColor || BLACK;
    state.swapAfterGame = Boolean(snapshot.swapAfterGame);
    state.nextBlackColor = snapshot.nextBlackColor || EMPTY;
    state.undoMode = snapshot.undoMode || "no-undo";
    state.timers = snapshot.timers || { black: 0, white: 0 };
    state.turnStartedAt = config.key === "reversi" && snapshot.turnStartedAt && state.started && !state.winner && !state.draw ? Date.now() : null;
    state.message = snapshot.message || state.message;
    if (undoModeSelect && config.key === "reversi") undoModeSelect.value = state.undoMode === "undo" ? "undo" : "no-undo";
    syncRoleFromSeat();
    updateLegalMoves();
    if (state.winner || state.draw) showResultModal();
    else hideResultModal();
  }

  function broadcastSnapshot() {
    if (state.mode === "online" && roomApi?.hasRoom?.()) {
      roomApi.broadcast(roomSnapshot());
    }
  }

  function resetRecord(label = "新房间") {
    state.record = { total: 0, players: {}, draw: 0 };
    state.recordLabel = label;
    state.gameCounted = false;
    state.nextBlackColor = EMPTY;
    state.swapAfterGame = false;
  }

  function normalizeRecord(record = state.record) {
    const normalized = {
      total: Number(record?.total) || 0,
      players: { ...(record?.players || {}) },
      draw: Number(record?.draw) || 0,
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

  function setupBoard() {
    applyWinnerBlackRule();
    state.board = createBoard();
    if (config.key === "reversi") {
      const midR = config.rows / 2 - 1;
      const midC = config.cols / 2 - 1;
      state.board[midR][midC] = WHITE;
      state.board[midR][midC + 1] = BLACK;
      state.board[midR + 1][midC] = BLACK;
      state.board[midR + 1][midC + 1] = WHITE;
    }
    state.moves = [];
    state.turn = BLACK;
    state.winner = EMPTY;
    state.draw = false;
    state.started = true;
    state.gameCounted = false;
    state.nextBlackColor = EMPTY;
    resetTimers();
    state.message = config.startMessage;
    updateLegalMoves();
    hideResultModal();
  }

  function startGame(announce = true) {
    if (state.mode === "online" && roomApi?.requireHost?.()) {
      const blocked = roomApi.requireHost();
      if (blocked) {
        state.message = blocked;
        render();
        return;
      }
    }
    if (state.mode === "idle") {
      state.message = "请先创建房间、加入房间或选择本地对战";
      render();
      return;
    }
    setupBoard();
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
    if (config.key === "reversi") state.undoMode = selectedUndoMode();
    state.players = { black: "本地玩家 A", white: "本地玩家 B" };
    resetRecord("本地房间");
    setupBoard();
    render();
  }

  function updateRoomControls() {
    const inOnlineRoom = state.mode === "online" && Boolean(state.roomId);
    if (localBtn) localBtn.hidden = inOnlineRoom;
    if (undoModeField) undoModeField.hidden = inOnlineRoom || config.key !== "reversi" || state.started;
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

  function inBounds(row, col) {
    return row >= 0 && col >= 0 && row < config.rows && col < config.cols;
  }

  function legalReversiFlips(row, col, color) {
    if (!inBounds(row, col) || state.board[row][col] !== EMPTY) return [];
    const opponent = color === BLACK ? WHITE : BLACK;
    const flips = [];
    DIRECTIONS.forEach(([dr, dc]) => {
      const line = [];
      let r = row + dr;
      let c = col + dc;
      while (inBounds(r, c) && state.board[r][c] === opponent) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }
      if (line.length && inBounds(r, c) && state.board[r][c] === color) flips.push(...line);
    });
    return flips;
  }

  function updateLegalMoves() {
    if (config.key !== "reversi" || !state.started || state.winner || state.draw) {
      state.legalMoves = [];
      return;
    }
    state.legalMoves = [];
    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.cols; col += 1) {
        if (legalReversiFlips(row, col, state.turn).length) state.legalMoves.push({ row, col });
      }
    }
  }

  function hasAnyReversiMove(color) {
    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.cols; col += 1) {
        if (legalReversiFlips(row, col, color).length) return true;
      }
    }
    return false;
  }

  function checkLineWin(row, col, color, length) {
    return [[0, 1], [1, 0], [1, 1], [1, -1]].some(([dr, dc]) => {
      let count = 1;
      for (const dir of [1, -1]) {
        let r = row + dr * dir;
        let c = col + dc * dir;
        while (inBounds(r, c) && state.board[r][c] === color) {
          count += 1;
          r += dr * dir;
          c += dc * dir;
        }
      }
      return count >= length;
    });
  }

  function boardFull() {
    return state.board.every((row) => row.every((cell) => cell !== EMPTY));
  }

  function countPieces() {
    return state.board.flat().reduce(
      (acc, cell) => {
        if (cell === BLACK) acc.black += 1;
        if (cell === WHITE) acc.white += 1;
        return acc;
      },
      { black: 0, white: 0 },
    );
  }

  function cellLabel(row, col) {
    return `${String.fromCharCode(65 + col)}${row + 1}`;
  }

  function resetTimers() {
    if (config.key !== "reversi") return;
    state.timers = { black: 0, white: 0 };
    state.turnStartedAt = Date.now();
  }

  function isReversiClockRunning() {
    return config.key === "reversi" && state.started && !state.winner && !state.draw && Boolean(state.turnStartedAt);
  }

  function elapsedTimers() {
    if (config.key !== "reversi") return null;
    const timers = { black: state.timers.black || 0, white: state.timers.white || 0 };
    if (isReversiClockRunning()) {
      timers[colorKey(state.turn)] += Math.max(0, Date.now() - state.turnStartedAt);
    }
    return timers;
  }

  function commitTurnTimer(color = state.turn) {
    if (config.key !== "reversi" || !state.turnStartedAt) return;
    const key = colorKey(color);
    state.timers = elapsedTimers();
    state.turnStartedAt = null;
    state.timers[key] = Math.max(0, state.timers[key] || 0);
  }

  function startTurnTimer() {
    if (config.key !== "reversi" || state.winner || state.draw || !state.started) return;
    state.turnStartedAt = Date.now();
  }

  function formatTimer(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function finishGame(winner, message) {
    state.winner = winner;
    state.draw = !winner;
    state.message = message;
    if (!state.gameCounted) {
      state.record = normalizeRecord();
      state.record.total += 1;
      if (winner === BLACK || winner === WHITE) countWinForPlayer(winner);
      else state.record.draw += 1;
      state.gameCounted = true;
      state.nextBlackColor = config.key === "tictactoe" ? WHITE : winner || EMPTY;
      state.swapAfterGame = Boolean(state.nextBlackColor);
    }
    showResultModal();
  }

  function afterMove(row, col, color) {
    if (config.key === "tictactoe") {
      if (checkLineWin(row, col, color, 3)) finishGame(color, `${colorName(color)}获胜`);
      else if (boardFull()) finishGame(EMPTY, "平局");
      else {
        state.turn = color === BLACK ? WHITE : BLACK;
        state.message = `轮到${colorName(state.turn)}`;
      }
      return;
    }

    if (config.key === "connect4") {
      if (checkLineWin(row, col, color, 4)) finishGame(color, `${colorName(color)}连成四子`);
      else if (boardFull()) finishGame(EMPTY, "平局");
      else {
        state.turn = color === BLACK ? WHITE : BLACK;
        state.message = `轮到${colorName(state.turn)}`;
      }
      return;
    }

    const next = color === BLACK ? WHITE : BLACK;
    if (hasAnyReversiMove(next)) {
      state.turn = next;
      updateLegalMoves();
      state.message = `轮到${colorName(state.turn)}`;
    } else if (hasAnyReversiMove(color)) {
      state.turn = color;
      updateLegalMoves();
      state.message = `${colorName(next)}无棋可下，${colorName(color)}继续`;
    } else {
      const pieces = countPieces();
      if (pieces.black > pieces.white) finishGame(BLACK, `黑棋 ${pieces.black}:${pieces.white} 获胜`);
      else if (pieces.white > pieces.black) finishGame(WHITE, `白棋 ${pieces.white}:${pieces.black} 获胜`);
      else finishGame(EMPTY, `双方 ${pieces.black}:${pieces.white} 平局`);
    }
  }

  function canPlay() {
    if (!state.started || state.winner || state.draw) return false;
    if (state.mode === "local") return true;
    if (state.mode !== "online") return false;
    return (state.role === "black" && state.turn === BLACK) || (state.role === "white" && state.turn === WHITE);
  }

  function canUndoLastMove() {
    if (config.key !== "reversi" || state.undoMode !== "undo" || !state.started || state.winner || state.draw) return false;
    const move = state.moves.at(-1);
    if (!move || !Array.isArray(move.flipCells)) return false;
    if (state.mode === "local") return true;
    if (state.mode !== "online") return false;
    return ownColor() === move.color;
  }

  function undoLastMove() {
    if (!canUndoLastMove()) {
      state.message = state.undoMode === "undo" ? "只能撤回自己的最新一步" : "当前房间未开启悔棋";
      render();
      return false;
    }
    const move = state.moves.pop();
    const revertedColor = oppositeColor(move.color);
    if (state.turnStartedAt) state.turnStartedAt = Date.now();
    state.board[move.row][move.col] = EMPTY;
    move.flipCells.forEach(({ row, col }) => {
      if (inBounds(row, col)) state.board[row][col] = revertedColor;
    });
    state.turn = move.color;
    state.winner = EMPTY;
    state.draw = false;
    state.message = `${colorName(move.color)}已悔一步，轮到${colorName(state.turn)}`;
    updateLegalMoves();
    render();
    broadcastSnapshot();
    return true;
  }

  function playCell(row, col) {
    if (!canPlay()) {
      state.message = state.started ? "还没轮到你操作" : "请先开始游戏";
      render();
      return false;
    }
    const color = state.turn;

    if (config.key === "connect4") {
      let targetRow = -1;
      for (let r = config.rows - 1; r >= 0; r -= 1) {
        if (state.board[r][col] === EMPTY) {
          targetRow = r;
          break;
        }
      }
      if (targetRow < 0) return false;
      state.board[targetRow][col] = color;
      state.moves.push({ row: targetRow, col, color });
      afterMove(targetRow, col, color);
    } else if (config.key === "reversi") {
      const flips = legalReversiFlips(row, col, color);
      if (!flips.length) return false;
      commitTurnTimer(color);
      state.board[row][col] = color;
      flips.forEach(([r, c]) => {
        state.board[r][c] = color;
      });
      state.moves.push({ row, col, color, flips: flips.length, flipCells: flips.map(([r, c]) => ({ row: r, col: c })) });
      afterMove(row, col, color);
      startTurnTimer();
    } else {
      if (state.board[row][col] !== EMPTY) return false;
      state.board[row][col] = color;
      state.moves.push({ row, col, color });
      afterMove(row, col, color);
    }

    render();
    broadcastSnapshot();
    return true;
  }

  function canvasToCell(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const geom = boardGeometry();
    const col = Math.floor((x - geom.x) / geom.cell);
    const row = Math.floor((y - geom.y) / geom.cell);
    if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) return null;
    return { row, col };
  }

  function boardGeometry() {
    const pad = config.key === "connect4" ? 54 : 46;
    const usable = canvas.width - pad * 2;
    const cell = Math.min(usable / config.cols, usable / config.rows);
    const width = cell * config.cols;
    const height = cell * config.rows;
    return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, cell, width, height };
  }

  function drawPiece(cx, cy, radius, color) {
    if (config.key === "connect4") {
      ctx.fillStyle = color === BLACK ? "#d84242" : "#f2d35e";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color === BLACK ? "#8c2020" : "#b48615";
      ctx.lineWidth = 4;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = color === BLACK ? "#1a2029" : "#f7f4ec";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color === BLACK ? "#0a0e14" : "#c7cbd3";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function renderBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = config.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const geom = boardGeometry();

    if (config.key === "connect4") {
      ctx.fillStyle = "#1557a3";
      roundRect(geom.x - 18, geom.y - 18, geom.width + 36, geom.height + 36, 24);
      ctx.fill();
    }

    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.cols; col += 1) {
        const x = geom.x + col * geom.cell;
        const y = geom.y + row * geom.cell;
        if (config.key === "connect4") {
          ctx.fillStyle = "#e9eef5";
          ctx.beginPath();
          ctx.arc(x + geom.cell / 2, y + geom.cell / 2, geom.cell * 0.36, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = config.key === "reversi" ? "rgba(2, 33, 24, 0.52)" : "rgba(68, 45, 17, 0.55)";
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, geom.cell, geom.cell);
        }
        const cell = state.board[row][col];
        if (cell && config.key !== "tictactoe") drawPiece(x + geom.cell / 2, y + geom.cell / 2, geom.cell * 0.34, cell);
      }
    }

    if (config.key === "tictactoe") {
      ctx.strokeStyle = "rgba(68, 45, 17, 0.7)";
      ctx.lineWidth = 8;
      for (let i = 1; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(geom.x + geom.cell * i, geom.y);
        ctx.lineTo(geom.x + geom.cell * i, geom.y + geom.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(geom.x, geom.y + geom.cell * i);
        ctx.lineTo(geom.x + geom.width, geom.y + geom.cell * i);
        ctx.stroke();
      }
      state.board.forEach((line, row) => {
        line.forEach((cell, col) => {
          const cx = geom.x + col * geom.cell + geom.cell / 2;
          const cy = geom.y + row * geom.cell + geom.cell / 2;
          if (cell === BLACK) drawX(cx, cy, geom.cell * 0.25);
          if (cell === WHITE) drawO(cx, cy, geom.cell * 0.28);
        });
      });
    }

    if (config.key === "reversi") {
      drawCoordinateLabels(geom);
      drawLastMoveMarker(geom);
    }

    if (config.key === "reversi" && canPlay()) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
      state.legalMoves.forEach(({ row, col }) => {
        ctx.beginPath();
        ctx.arc(geom.x + col * geom.cell + geom.cell / 2, geom.y + row * geom.cell + geom.cell / 2, geom.cell * 0.12, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function drawLastMoveMarker(geom) {
    const move = state.moves.at(-1);
    if (!move) return;
    const cx = geom.x + move.col * geom.cell + geom.cell / 2;
    const cy = geom.y + move.row * geom.cell + geom.cell / 2;
    ctx.beginPath();
    ctx.strokeStyle = move.color === BLACK ? "#f7df73" : "#5d4037";
    ctx.lineWidth = 4;
    ctx.arc(cx, cy, geom.cell * 0.12, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawCoordinateLabels(geom) {
    ctx.fillStyle = "rgba(42, 28, 10, 0.78)";
    ctx.font = "700 17px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let col = 0; col < config.cols; col += 1) {
      const x = geom.x + col * geom.cell + geom.cell / 2;
      ctx.fillText(String.fromCharCode(65 + col), x, geom.y - 20);
      ctx.fillText(String.fromCharCode(65 + col), x, geom.y + geom.height + 20);
    }
    for (let row = 0; row < config.rows; row += 1) {
      const y = geom.y + row * geom.cell + geom.cell / 2;
      ctx.fillText(String(row + 1), geom.x - 22, y);
      ctx.fillText(String(row + 1), geom.x + geom.width + 22, y);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawX(cx, cy, size) {
    ctx.strokeStyle = "#17212b";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy + size);
    ctx.moveTo(cx + size, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  function drawO(cx, cy, radius) {
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function renderStatus() {
    const pieces = countPieces();
    const timers = elapsedTimers();
    if (undoModeSelect && config.key === "reversi" && !state.started) {
      undoModeSelect.value = state.undoMode === "undo" ? "undo" : "no-undo";
    }
    const blackCount = config.key === "reversi" && !blackPieceCount ? `（${pieces.black}）` : "";
    const whiteCount = config.key === "reversi" && !whitePieceCount ? `（${pieces.white}）` : "";
    const blackTimer = timers ? ` ${formatTimer(timers.black)}` : "";
    const whiteTimer = timers ? ` ${formatTimer(timers.white)}` : "";
    blackPlayer.textContent = `${config.labels.black}：${state.players.black}${blackCount}${blackTimer}`;
    whitePlayer.textContent = `${config.labels.white}：${state.players.white}${whiteCount}${whiteTimer}`;
    if (blackPieceCount) blackPieceCount.textContent = pieces.black;
    if (whitePieceCount) whitePieceCount.textContent = pieces.white;
    blackPlayer.classList.toggle("active-timer", config.key === "reversi" && state.started && !state.winner && !state.draw && state.turn === BLACK);
    whitePlayer.classList.toggle("active-timer", config.key === "reversi" && state.started && !state.winner && !state.draw && state.turn === WHITE);
    if (undoBtn) {
      undoBtn.hidden = config.key !== "reversi";
      undoBtn.disabled = !canUndoLastMove();
    }
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
    turnBadge.textContent = state.winner ? `${colorName(state.winner)}获胜` : state.draw ? "平局" : state.started ? `${colorName(state.turn)}回合` : "等待开始";
    matchStatus.textContent = state.message;
    startBtn.disabled = state.mode === "idle" || (state.mode === "online" && !roomApi?.isHost?.());
    restartBtn.disabled = state.mode === "idle" || (state.mode === "online" && !roomApi?.isHost?.());
    updateRoomControls();
    moveList.innerHTML = "";
    state.moves.slice(-18).forEach((move, index) => {
      const item = document.createElement("li");
      const extra = move.flips ? `，翻转 ${move.flips}` : "";
      const point = config.key === "reversi" ? cellLabel(move.row, move.col) : `${move.row + 1}, ${move.col + 1}`;
      item.textContent = `${Math.max(0, state.moves.length - 18) + index + 1}. ${colorName(move.color)} (${point})${extra}`;
      moveList.appendChild(item);
    });
  }

  function render() {
    renderBoard();
    renderStatus();
  }

  function showResultModal() {
    resultModal.hidden = false;
    resultTitle.textContent = "本局结束";
    resultSummary.textContent = state.draw ? "本局平局，要再开一把吗？" : `${colorName(state.winner)}获胜，要再开一把吗？`;
  }

  function hideResultModal() {
    resultModal.hidden = true;
  }

  function exitToLobby() {
    roomApi?.leaveRoom?.();
    window.location.href = "index.html";
  }

  canvas.addEventListener("click", (event) => {
    const cell = canvasToCell(event);
    if (!cell) return;
    playCell(cell.row, cell.col);
  });

  localBtn.addEventListener("click", startLocal);
  undoModeSelect?.addEventListener("change", () => {
    state.undoMode = selectedUndoMode();
    if (config.key === "reversi" && state.mode !== "idle" && !state.started) broadcastSnapshot();
    render();
  });
  startBtn.addEventListener("click", () => startGame(true));
  restartBtn.addEventListener("click", () => {
    resetRecord(state.mode === "local" ? "本地房间" : "当前房间");
    startGame(true);
  });
  playAgainBtn.addEventListener("click", () => startGame(true));
  undoBtn?.addEventListener("click", undoLastMove);
  exitRoomBtn.addEventListener("click", exitToLobby);
  window.addEventListener("resize", render);

  window.render_game_to_text = () =>
    JSON.stringify({
      game: config.key,
      mode: state.mode,
      role: state.role,
      roomId: state.roomId,
      rows: config.rows,
      cols: config.cols,
      board: state.board,
      hostColor: colorName(state.hostColor),
      swapAfterGame: state.swapAfterGame,
      nextBlackColor: state.nextBlackColor ? colorName(state.nextBlackColor) : null,
      undoMode: state.undoMode,
      pieceCounts: config.key === "reversi" ? countPieces() : null,
      timers: elapsedTimers(),
      moves: state.moves.map((move) => ({
        ...move,
        point: config.key === "reversi" ? cellLabel(move.row, move.col) : `${move.row + 1}, ${move.col + 1}`,
      })),
      turn: colorName(state.turn),
      winner: state.winner ? colorName(state.winner) : null,
      draw: state.draw,
      started: state.started,
      players: state.players,
      record: state.record,
      message: state.message,
      legalMoves: state.legalMoves,
      modalOpen: !resultModal.hidden,
      room: state.room,
    });

  window.advanceTime = () => render();

  updateLegalMoves();
  if (config.key === "reversi") {
    renderTicker = window.setInterval(() => {
      if (isReversiClockRunning()) render();
    }, 250);
    window.addEventListener("beforeunload", () => {
      if (renderTicker) window.clearInterval(renderTicker);
    });
  }
  render();
})();
