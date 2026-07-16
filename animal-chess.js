const animalBoard = document.querySelector("#animalBoard");
const animalTurn = document.querySelector("#animalTurn");
const animalLog = document.querySelector("#animalLog");
const animalRoomBadge = document.querySelector("#animalRoomBadge");
const animalCountBadge = document.querySelector("#animalCountBadge");
const animalSideBadge = document.querySelector("#animalSideBadge");

const animalPiecesOrder = [
  { name: "鼠", rank: 1 },
  { name: "猫", rank: 2 },
  { name: "狗", rank: 3 },
  { name: "狼", rank: 4 },
  { name: "豹", rank: 5 },
  { name: "虎", rank: 6 },
  { name: "狮", rank: 7 },
  { name: "象", rank: 8 },
];

const animalState = {
  pieces: initialPieces(),
  turn: "red",
  selectedId: "",
  targets: [],
  started: false,
  over: false,
  winner: "",
  message: "点击创建或加入房间后，由房主开始对局。",
  moves: [],
  lastMove: null,
  room: null,
};

const animalRoomApi = window.initRoomPanel({
  gameKey: "animal-chess",
  prefix: "DS",
  getSnapshot: () => animalState,
  onRemoteState(snapshot) {
    const localRoom = animalState.room;
    Object.assign(animalState, snapshot);
    animalState.room = localRoom;
    ensureStateShape();
    renderAnimal();
  },
  onRoomChange(room) {
    animalState.room = room;
    animalRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

document.querySelector("#startAnimalBtn").addEventListener("click", startAnimalGame);
document.querySelector("#resetAnimalBtn").addEventListener("click", startAnimalGame);

function initialPieces() {
  return [
    piece("red", "狮", 7, 8, 0),
    piece("red", "虎", 6, 8, 6),
    piece("red", "狗", 3, 7, 1),
    piece("red", "猫", 2, 7, 5),
    piece("red", "鼠", 1, 6, 0),
    piece("red", "豹", 5, 6, 2),
    piece("red", "狼", 4, 6, 4),
    piece("red", "象", 8, 6, 6),
    piece("blue", "狮", 7, 0, 6),
    piece("blue", "虎", 6, 0, 0),
    piece("blue", "狗", 3, 1, 5),
    piece("blue", "猫", 2, 1, 1),
    piece("blue", "鼠", 1, 2, 6),
    piece("blue", "豹", 5, 2, 4),
    piece("blue", "狼", 4, 2, 2),
    piece("blue", "象", 8, 2, 0),
  ];
}

function piece(owner, name, rank, row, col) {
  return {
    id: `${owner}-${name}-${row}-${col}-${Math.random().toString(36).slice(2, 8)}`,
    owner,
    name,
    rank,
    row,
    col,
    alive: true,
  };
}

function ensureStateShape() {
  animalState.pieces ||= [];
  animalState.targets ||= [];
  animalState.moves ||= [];
  animalState.message ||= "";
  animalState.turn ||= "red";
  animalState.winner ||= "";
  animalState.lastMove ||= null;
  animalState.selectedId ||= "";
  animalState.room ||= null;
}

function startAnimalGame() {
  const blocked = animalRoomApi.requireHost();
  if (blocked) {
    animalState.message = blocked;
    renderAnimal();
    return;
  }
  animalState.pieces = initialPieces();
  animalState.turn = "red";
  animalState.selectedId = "";
  animalState.targets = [];
  animalState.started = true;
  animalState.over = false;
  animalState.winner = "";
  animalState.message = "红方先手。";
  animalState.moves = [];
  animalState.lastMove = null;
  renderAnimal();
  syncAnimal();
}

function syncAnimal() {
  animalRoomApi.broadcast(animalState);
}

function inBounds(row, col) {
  return row >= 0 && row < 9 && col >= 0 && col < 7;
}

function terrainAt(row, col) {
  if ((row === 0 || row === 8) && col === 3) return row === 0 ? "blue-den" : "red-den";
  if (
    (row === 0 && [2, 4].includes(col)) ||
    (row === 1 && [3].includes(col)) ||
    (row === 7 && [3].includes(col)) ||
    (row === 8 && [2, 4].includes(col))
  ) {
    return row < 4 ? "blue-trap" : "red-trap";
  }
  if (row >= 3 && row <= 5 && [1, 2, 4, 5].includes(col)) return "river";
  return "land";
}

function pieceAt(row, col) {
  return animalState.pieces.find((item) => item.alive && item.row === row && item.col === col);
}

function terrainClass(row, col) {
  const terrain = terrainAt(row, col);
  if (terrain === "blue-den") return "den-blue";
  if (terrain === "red-den") return "den-red";
  if (terrain === "river") return "river";
  if (terrain.includes("trap")) return "trap";
  return "";
}

function isOwnDen(owner, row, col) {
  return terrainAt(row, col) === `${owner}-den`;
}

function isTrapFor(attackerOwner, row, col) {
  return terrainAt(row, col) === `${attackerOwner === "red" ? "blue" : "red"}-trap`;
}

function aliveCount(owner) {
  return animalState.pieces.filter((item) => item.alive && item.owner === owner).length;
}

function localSide() {
  return animalRoomApi.isGuest() ? "blue" : "red";
}

function sideLabel(side) {
  return side === "red" ? "红方" : "蓝方";
}

function canControl(piece) {
  return piece.owner === localSide() && animalState.turn === piece.owner;
}

function canCapture(attacker, defender, row, col) {
  if (attacker.owner === defender.owner) return false;
  if (attacker.name === "鼠" && defender.name === "象") return true;
  if (attacker.name === "象" && defender.name === "鼠") return false;
  const effectiveRank = isTrapFor(attacker.owner, row, col) ? 0 : defender.rank;
  return attacker.rank >= effectiveRank;
}

function stepTarget(piece, dr, dc) {
  const row = piece.row + dr;
  const col = piece.col + dc;
  if (!inBounds(row, col)) return null;
  if (isOwnDen(piece.owner, row, col)) return null;
  const terrain = terrainAt(row, col);
  if (terrain === "river" && piece.name !== "鼠") return null;
  const occupant = pieceAt(row, col);
  if (!occupant) return { row, col };
  if (!canCapture(piece, occupant, row, col)) return null;
  return { row, col };
}

function jumpTarget(piece, dr, dc) {
  if (!["虎", "狮"].includes(piece.name)) return null;
  let row = piece.row + dr;
  let col = piece.col + dc;
  if (!inBounds(row, col) || terrainAt(row, col) !== "river") return null;
  while (inBounds(row, col) && terrainAt(row, col) === "river") {
    if (pieceAt(row, col)?.name === "鼠") return null;
    row += dr;
    col += dc;
  }
  if (!inBounds(row, col)) return null;
  if (isOwnDen(piece.owner, row, col)) return null;
  const occupant = pieceAt(row, col);
  if (!occupant) return { row, col };
  if (!canCapture(piece, occupant, row, col)) return null;
  return { row, col };
}

function legalTargets(piece) {
  const result = [];
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  dirs.forEach(([dr, dc]) => {
    const next = stepTarget(piece, dr, dc);
    if (next) result.push(next);
    const jump = jumpTarget(piece, dr, dc);
    if (jump) result.push(jump);
  });
  return result.filter((item, index, list) => list.findIndex((other) => other.row === item.row && other.col === item.col) === index);
}

function selectedPiece() {
  return animalState.pieces.find((item) => item.id === animalState.selectedId && item.alive) || null;
}

function removeSelection() {
  animalState.selectedId = "";
  animalState.targets = [];
}

function movePiece(piece, row, col) {
  const targetPiece = pieceAt(row, col);
  if (targetPiece) targetPiece.alive = false;
  const from = { row: piece.row, col: piece.col };
  piece.row = row;
  piece.col = col;
  animalState.lastMove = { id: piece.id, owner: piece.owner, from, to: { row, col } };
  animalState.moves = [...animalState.moves.slice(-11), { owner: piece.owner, name: piece.name, from, to: { row, col }, capture: targetPiece?.name || "" }];
  if (terrainAt(row, col) === `${piece.owner === "red" ? "blue" : "red"}-den`) {
    animalState.over = true;
    animalState.winner = piece.owner;
    animalState.message = `${sideLabel(piece.owner)} 进入兽穴，直接获胜。`;
    removeSelection();
    return;
  }
  const opponent = piece.owner === "red" ? "blue" : "red";
  if (aliveCount(opponent) === 0) {
    animalState.over = true;
    animalState.winner = piece.owner;
    animalState.message = `${sideLabel(piece.owner)} 吃光了对手全部棋子。`;
    removeSelection();
    return;
  }
  animalState.turn = opponent;
  animalState.message = `${sideLabel(piece.owner)} 的 ${piece.name} ${coordText(from.row, from.col)} -> ${coordText(row, col)}${targetPiece ? `，吃掉 ${targetPiece.name}` : ""}。`;
  removeSelection();
}

function coordText(row, col) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function handleCellClick(row, col) {
  if (!animalState.started || animalState.over) return;
  const piece = pieceAt(row, col);
  const current = selectedPiece();

  if (piece && canControl(piece)) {
    animalState.selectedId = piece.id;
    animalState.targets = legalTargets(piece);
    animalState.message = `${sideLabel(piece.owner)} 选中 ${piece.name}。`;
    renderAnimal();
    syncAnimal();
    return;
  }

  if (!current || !canControl(current)) return;
  const target = animalState.targets.find((item) => item.row === row && item.col === col);
  if (!target) return;
  movePiece(current, target.row, target.col);
  renderAnimal();
  syncAnimal();
}

function renderAnimal() {
  ensureStateShape();
  const redCount = aliveCount("red");
  const blueCount = aliveCount("blue");
  animalTurn.textContent = animalState.over
    ? `${sideLabel(animalState.winner)} 胜利`
    : animalState.started
      ? `${sideLabel(animalState.turn)} 回合`
      : "等待开局";
  animalSideBadge.textContent = animalState.over ? "对局结束" : `轮到${sideLabel(animalState.turn)}`;
  animalCountBadge.textContent = `子力：红 ${redCount} / 蓝 ${blueCount}`;
  animalLog.textContent = animalState.message;
  if (animalState.room?.roomId) {
    animalRoomBadge.textContent = `房间：${animalState.room.roomId}`;
  } else {
    animalRoomBadge.textContent = "房间：未进入";
  }

  animalBoard.innerHTML = "";
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `animal-cell ${terrainClass(row, col)}`.trim();
      const terrain = terrainAt(row, col);
      if (terrain !== "land") {
        const label = document.createElement("span");
        label.className = "cell-label";
        label.textContent =
          terrain === "river" ? "河" : terrain === "red-den" ? "穴" : terrain === "blue-den" ? "穴" : "阱";
        cell.appendChild(label);
      }
      if (animalState.targets.some((item) => item.row === row && item.col === col)) cell.classList.add("target");
      const piece = pieceAt(row, col);
      if (piece) {
        const selected = piece.id === animalState.selectedId;
        if (selected) cell.classList.add("selected");
        if (animalState.lastMove?.id === piece.id) cell.classList.add("last-move");
        const token = document.createElement("span");
        token.className = `animal-piece ${piece.owner}`;
        token.textContent = piece.name;
        token.title = `${sideLabel(piece.owner)} ${piece.name}`;
        cell.appendChild(token);
      }
      cell.addEventListener("click", () => handleCellClick(row, col));
      animalBoard.appendChild(cell);
    }
  }
}

function renderStateText() {
  return JSON.stringify({
    origin: "top-left",
    board: { rows: 9, cols: 7 },
    started: animalState.started,
    turn: animalState.turn,
    selectedId: animalState.selectedId,
    targets: animalState.targets,
    over: animalState.over,
    winner: animalState.winner,
    message: animalState.message,
    counts: {
      red: aliveCount("red"),
      blue: aliveCount("blue"),
    },
    lastMove: animalState.lastMove,
    pieces: animalState.pieces
      .filter((item) => item.alive)
      .map((item) => ({
        id: item.id,
        owner: item.owner,
        name: item.name,
        row: item.row,
        col: item.col,
      })),
    room: animalState.room ? { roomId: animalState.room.roomId, role: animalState.room.role } : null,
    moves: animalState.moves,
  });
}

window.render_game_to_text = renderStateText;
window.advanceTime = () => renderAnimal();

renderAnimal();
