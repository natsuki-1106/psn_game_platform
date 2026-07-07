const teamColors = ["red", "blue", "green", "gold"];
const teamNames = ["红方", "蓝方", "绿方", "黄方"];

const ludoVisualCells = [
  ...range(1, 6).flatMap((col) => [[7, col], [8, col], [9, col]]),
  ...range(10, 15).flatMap((col) => [[7, col], [8, col], [9, col]]),
  ...range(1, 6).flatMap((row) => [[row, 7], [row, 8], [row, 9]]),
  ...range(10, 15).flatMap((row) => [[row, 7], [row, 8], [row, 9]]),
];

const ludoTrack = [
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [8, 6],
  [7, 7],
  [6, 8],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [7, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [8, 15],
  [9, 9],
  [10, 8],
  [11, 8],
  [12, 8],
];

const ludoHomeRuns = {
  red: [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7]],
  blue: [[2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8]],
  green: [[8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9]],
  gold: [[14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8]],
};

const ludoHomes = {
  red: { row: 2, col: 2, label: "红方机场" },
  blue: { row: 2, col: 10, label: "蓝方机场" },
  green: { row: 10, col: 10, label: "绿方机场" },
  gold: { row: 10, col: 2, label: "黄方机场" },
};

const ludoState = { teams: [], turn: 0, dice: 0, started: false, over: false, room: null };

const ludoBoard = document.querySelector("#ludoBoard");
const ludoTurn = document.querySelector("#ludoTurn");
const ludoPieces = document.querySelector("#ludoPieces");
const ludoLog = document.querySelector("#ludoLog");
const ludoPlayerCount = document.querySelector("#ludoPlayerCount");
const ludoRoomBadge = document.querySelector("#ludoRoomBadge");
let ludoRoomApi = null;
document.querySelector("#startLudoBtn").addEventListener("click", startLudo);
document.querySelector("#rollLudoBtn").addEventListener("click", rollLudo);
document.querySelector("#resetLudoBtn").addEventListener("click", startLudo);

ludoRoomApi = window.initRoomPanel({
  gameKey: "ludo",
  prefix: "FQ",
  getSnapshot: () => ludoState,
  onRemoteState(snapshot) {
    const localRoom = ludoState.room;
    Object.assign(ludoState, snapshot);
    ludoState.room = localRoom;
    renderLudo();
  },
  onRoomChange(room) {
    ludoState.room = room;
    ludoRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

function syncLudo() {
  ludoRoomApi.broadcast(ludoState);
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function startLudo() {
  const blocked = ludoRoomApi.requireHost();
  if (blocked) {
    ludoLog.textContent = blocked;
    renderLudo();
    return;
  }
  const count = Number(ludoPlayerCount.value);
  ludoState.teams = Array.from({ length: count }, (_, index) => ({
    name: teamNames[index],
    color: teamColors[index],
    pieces: [-1, -1],
  }));
  ludoState.turn = 0;
  ludoState.dice = 0;
  ludoState.started = true;
  ludoState.over = false;
  ludoLog.textContent = `${count} 人飞行棋开始，掷到 6 可以起飞。`;
  renderLudo();
  syncLudo();
}

function renderLudo() {
  ludoBoard.innerHTML = "";
  renderLudoHomes();
  renderLudoRoutes();
  renderLudoCenter();
  renderLudoPlanes();

  ludoTurn.textContent = !ludoState.started ? "等待开始" : ludoState.over ? "已结束" : ludoState.teams[ludoState.turn].name;
  ludoPieces.innerHTML = "";
  ludoState.teams.forEach((team, teamIndex) => {
    const card = document.createElement("section");
    card.className = `ludo-team-card ${team.color}`;
    card.innerHTML = `<strong>${team.name}</strong>`;
    team.pieces.forEach((pos, index) => {
      const piece = document.createElement("button");
      piece.className = "piece-button";
      piece.type = "button";
      piece.textContent = `${index + 1}号 ${pos < 0 ? "待起飞" : pos >= ludoTrack.length - 1 ? "到达" : `航道 ${pos}`}`;
      piece.disabled = teamIndex !== ludoState.turn || ludoState.dice === 0 || ludoState.over;
      piece.addEventListener("click", () => moveLudoPiece(index));
      card.appendChild(piece);
    });
    ludoPieces.appendChild(card);
  });
}

function renderLudoHomes() {
  Object.entries(ludoHomes).forEach(([color, home]) => {
    const pad = document.createElement("div");
    pad.className = `ludo-home ${color}`;
    pad.style.gridRow = `${home.row} / span 4`;
    pad.style.gridColumn = `${home.col} / span 4`;
    pad.innerHTML = `
      <strong>${home.label}</strong>
      <span></span><span></span><span></span><span></span>
    `;
    ludoBoard.appendChild(pad);
  });
}

function renderLudoRoutes() {
  const homeRunKeys = new Set(Object.values(ludoHomeRuns).flat().map(([row, col]) => `${row}-${col}`));
  ludoVisualCells.forEach(([row, col], index) => {
    const key = `${row}-${col}`;
    if (row >= 7 && row <= 9 && col >= 7 && col <= 9) return;
    const cell = document.createElement("div");
    cell.className = `ludo-cell ${homeRunKeys.has(key) ? "muted" : teamColors[index % 4]}`;
    cell.style.gridRow = row;
    cell.style.gridColumn = col;
    ludoBoard.appendChild(cell);
  });

  Object.entries(ludoHomeRuns).forEach(([color, cells]) => {
    cells.forEach(([row, col], index) => {
      const cell = document.createElement("div");
      cell.className = `ludo-cell home-run ${color}`;
      cell.style.gridRow = row;
      cell.style.gridColumn = col;
      cell.textContent = index === cells.length - 1 ? "终" : "";
      ludoBoard.appendChild(cell);
    });
  });

  [
    [8, 1, "red"],
    [1, 8, "blue"],
    [8, 15, "green"],
    [15, 8, "gold"],
  ].forEach(([row, col, color]) => {
    const cell = document.createElement("div");
    cell.className = `ludo-cell start ${color}`;
    cell.style.gridRow = row;
    cell.style.gridColumn = col;
    cell.textContent = "起";
    ludoBoard.appendChild(cell);
  });
}

function renderLudoCenter() {
  const center = document.createElement("div");
  center.className = "ludo-center";
  center.style.gridRow = "7 / span 3";
  center.style.gridColumn = "7 / span 3";
  center.innerHTML = "<span>✈</span><strong>终点</strong>";
  ludoBoard.appendChild(center);
}

function renderLudoPlanes() {
  ludoState.teams.forEach((team) => {
    team.pieces.forEach((pos, pieceIndex) => {
      const plane = document.createElement("span");
      plane.className = `ludo-plane ${team.color}`;
      plane.textContent = "✈";
      plane.dataset.label = pieceIndex + 1;
      if (pos < 0) {
        const home = ludoHomes[team.color];
        plane.style.gridRow = home.row + 1 + Math.floor(pieceIndex / 2);
        plane.style.gridColumn = home.col + 1 + (pieceIndex % 2);
      } else {
        const [row, col] = ludoTrack[Math.min(pos, ludoTrack.length - 1)];
        plane.style.gridRow = row;
        plane.style.gridColumn = col;
      }
      ludoBoard.appendChild(plane);
    });
  });
}

function rollLudo() {
  if (!ludoState.started || ludoState.over || ludoState.dice) return;
  ludoState.dice = Math.floor(Math.random() * 6) + 1;
  ludoLog.textContent = `${ludoState.teams[ludoState.turn].name} 掷出 ${ludoState.dice}。`;
  renderLudo();
  syncLudo();
}

function moveLudoPiece(pieceIndex) {
  const team = ludoState.teams[ludoState.turn];
  const dice = ludoState.dice;
  if (!dice) return;

  if (team.pieces[pieceIndex] < 0) {
    if (dice !== 6) {
      ludoLog.textContent = "只有掷到 6 才能起飞。";
      endLudoTurn();
      renderLudo();
      syncLudo();
      return;
    }
    team.pieces[pieceIndex] = 0;
  } else {
    team.pieces[pieceIndex] = Math.min(ludoTrack.length - 1, team.pieces[pieceIndex] + dice);
  }

  if (team.pieces.every((pos) => pos >= ludoTrack.length - 1)) {
    ludoState.over = true;
    ludoLog.textContent = `${team.name} 全部到达终点，获胜！`;
  } else {
    ludoLog.textContent = `${team.name}${pieceIndex + 1} 移动完成。`;
    endLudoTurn();
  }
  renderLudo();
  syncLudo();
}

function endLudoTurn() {
  ludoState.dice = 0;
  ludoState.turn = (ludoState.turn + 1) % ludoState.teams.length;
}

window.render_game_to_text = () => JSON.stringify(ludoState);
window.advanceTime = () => renderLudo();
renderLudo();
