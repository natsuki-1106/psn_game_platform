const teamColors = ["red", "blue", "green", "gold"];
const teamNames = ["红方", "蓝方", "绿方", "黄方"];
const ludoTrack = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [6, 7],
  [7, 8],
  [8, 7],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [8, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
];
const ludoHomeRuns = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  blue: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  green: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  gold: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};
const ludoHomes = {
  red: { row: 1, col: 1, label: "红方机场" },
  blue: { row: 1, col: 10, label: "蓝方机场" },
  green: { row: 10, col: 10, label: "绿方机场" },
  gold: { row: 10, col: 1, label: "黄方机场" },
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
  onRoomChange(room) {
    ludoState.room = room;
    ludoRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

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
      piece.textContent = `${index + 1}号 ${pos < 0 ? "待起飞" : pos >= 23 ? "到达" : `航道 ${pos}`}`;
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
    pad.style.gridRow = `${home.row} / span 5`;
    pad.style.gridColumn = `${home.col} / span 5`;
    pad.innerHTML = `
      <strong>${home.label}</strong>
      <span></span><span></span><span></span><span></span>
    `;
    ludoBoard.appendChild(pad);
  });
}

function renderLudoRoutes() {
  ludoTrack.forEach(([row, col], index) => {
    const cell = document.createElement("div");
    cell.className = `ludo-cell ${teamColors[index % 4]} ${index === 0 ? "start" : ""}`;
    cell.style.gridRow = row;
    cell.style.gridColumn = col;
    cell.textContent = index === 0 ? "起" : "";
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
}

function renderLudoCenter() {
  const center = document.createElement("div");
  center.className = "ludo-center";
  center.style.gridRow = "6 / span 4";
  center.style.gridColumn = "6 / span 4";
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
        plane.style.gridRow = home.row + 2 + Math.floor(pieceIndex / 2);
        plane.style.gridColumn = home.col + 2 + (pieceIndex % 2);
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
}

function moveLudoPiece(pieceIndex) {
  const team = ludoState.teams[ludoState.turn];
  const dice = ludoState.dice;
  if (!dice) return;

  if (team.pieces[pieceIndex] < 0) {
    if (dice !== 6) {
      ludoLog.textContent = "只有掷到 6 才能起飞。";
      endLudoTurn();
      return;
    }
    team.pieces[pieceIndex] = 0;
  } else {
    team.pieces[pieceIndex] = Math.min(23, team.pieces[pieceIndex] + dice);
  }

  if (team.pieces.every((pos) => pos >= 23)) {
    ludoState.over = true;
    ludoLog.textContent = `${team.name} 全部到达终点，获胜！`;
  } else {
    ludoLog.textContent = `${team.name}${pieceIndex + 1} 移动完成。`;
    endLudoTurn();
  }
  renderLudo();
}

function endLudoTurn() {
  ludoState.dice = 0;
  ludoState.turn = (ludoState.turn + 1) % ludoState.teams.length;
}

window.render_game_to_text = () => JSON.stringify(ludoState);
window.advanceTime = () => renderLudo();
renderLudo();
