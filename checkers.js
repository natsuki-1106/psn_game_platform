const checkersBoard = document.querySelector("#checkersBoard");
const checkersTurn = document.querySelector("#checkersTurn");
const checkersLog = document.querySelector("#checkersLog");
const checkersPlayerCount = document.querySelector("#checkersPlayerCount");
const checkersRoomBadge = document.querySelector("#checkersRoomBadge");

const checkersColors = ["red", "blue", "green", "gold", "purple", "orange"];
const colorNames = ["红方", "蓝方", "绿方", "黄方", "紫方", "橙方"];
const starRows = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
const starCells = buildStarCells();
const starts = [
  { color: "red", target: "green", cells: cellsByRegion("bottom") },
  { color: "blue", target: "gold", cells: cellsByRegion("left") },
  { color: "green", target: "red", cells: cellsByRegion("top") },
  { color: "gold", target: "blue", cells: cellsByRegion("right") },
  { color: "purple", target: "orange", cells: cellsByRegion("bottomLeft") },
  { color: "orange", target: "purple", cells: cellsByRegion("bottomRight") },
];

const checkersState = {
  players: [],
  turn: 0,
  selected: false,
  targets: [],
  started: false,
  over: false,
  room: null,
};

const checkersRoomApi = window.initRoomPanel({
  gameKey: "checkers",
  prefix: "TQ",
  onRoomChange(room) {
    checkersState.room = room;
    checkersRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

document.querySelector("#startCheckersBtn").addEventListener("click", startCheckers);
document.querySelector("#resetCheckersBtn").addEventListener("click", startCheckers);

function buildStarCells() {
  const cells = [];
  starRows.forEach((count, row) => {
    const start = (13 - count) / 2;
    for (let index = 0; index < count; index += 1) {
      cells.push({
        row,
        index,
        x: (start + index) / 12,
        y: row / 16,
        region: regionFor(row, index, count),
      });
    }
  });
  return cells;
}

function regionFor(row, index, count) {
  if (row <= 3) return "top";
  if (row >= 13) return "bottom";
  if (row >= 4 && row <= 7 && index < 4 - (row - 4)) return "left";
  if (row >= 4 && row <= 7 && index >= count - (4 - (row - 4))) return "right";
  if (row >= 9 && row <= 12 && index < row - 8) return "bottomLeft";
  if (row >= 9 && row <= 12 && index >= count - (row - 8)) return "bottomRight";
  return "center";
}

function cellsByRegion(region) {
  return starCells.filter((cell) => cell.region === region).slice(0, 10);
}

function startCheckers() {
  const blocked = checkersRoomApi.requireHost();
  if (blocked) {
    checkersLog.textContent = blocked;
    renderCheckers();
    return;
  }
  const count = Number(checkersPlayerCount.value);
  checkersState.players = Array.from({ length: count }, (_, index) => {
    const start = starts[index];
    const cell = start.cells[0];
    return {
      name: colorNames[index],
      color: checkersColors[index],
      row: cell.row,
      index: cell.index,
      target: start.target,
    };
  });
  checkersState.turn = 0;
  checkersState.selected = false;
  checkersState.targets = [];
  checkersState.started = true;
  checkersState.over = false;
  checkersLog.textContent = `${count} 人跳棋开始。点击当前玩家棋子，再点击高亮目标点。`;
  renderCheckers();
}

function currentPlayer() {
  return checkersState.players[checkersState.turn];
}

function sameCell(a, b) {
  return a.row === b.row && a.index === b.index;
}

function occupied(row, index) {
  return checkersState.players.some((player) => player.row === row && player.index === index);
}

function getCell(row, index) {
  return starCells.find((cell) => cell.row === row && cell.index === index);
}

function nearbyCells(cell, distance = 0.105) {
  return starCells.filter((other) => {
    if (sameCell(cell, other)) return false;
    const dx = other.x - cell.x;
    const dy = (other.y - cell.y) * 0.88;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist > 0 && dist <= distance;
  });
}

function legalTargets(player) {
  const cell = getCell(player.row, player.index);
  if (!cell) return [];
  const targets = [];
  nearbyCells(cell).forEach((near) => {
    if (!occupied(near.row, near.index)) targets.push({ row: near.row, index: near.index });
    const jump = starCells.find((candidate) => {
      const dx = candidate.x - cell.x;
      const dy = candidate.y - cell.y;
      return Math.abs(dx - (near.x - cell.x) * 2) < 0.035 && Math.abs(dy - (near.y - cell.y) * 2) < 0.035;
    });
    if (jump && occupied(near.row, near.index) && !occupied(jump.row, jump.index)) {
      targets.push({ row: jump.row, index: jump.index });
    }
  });
  return targets;
}

function clickChecker(row, index) {
  if (!checkersState.started || checkersState.over) return;
  const player = currentPlayer();
  if (player.row === row && player.index === index) {
    checkersState.selected = true;
    checkersState.targets = legalTargets(player);
    renderCheckers();
    return;
  }
  const target = checkersState.targets.find((item) => item.row === row && item.index === index);
  if (!checkersState.selected || !target) return;
  player.row = target.row;
  player.index = target.index;
  checkersState.selected = false;
  checkersState.targets = [];
  const targetCell = getCell(player.row, player.index);
  if (targetCell?.region === player.target) {
    checkersState.over = true;
    checkersLog.textContent = `${player.name} 到达目标区域，获胜！`;
  } else {
    checkersState.turn = (checkersState.turn + 1) % checkersState.players.length;
    checkersLog.textContent = `轮到 ${currentPlayer().name}。`;
  }
  renderCheckers();
}

function renderCheckers() {
  checkersBoard.innerHTML = "";
  checkersTurn.textContent = !checkersState.started ? "等待开始" : checkersState.over ? "已结束" : currentPlayer().name;

  starCells.forEach((cell) => {
    const hole = document.createElement("button");
    hole.type = "button";
    hole.className = `chinese-hole region-${cell.region}`;
    hole.style.left = `${7 + cell.x * 86}%`;
    hole.style.top = `${5 + cell.y * 90}%`;
    if (checkersState.targets.some((target) => target.row === cell.row && target.index === cell.index)) hole.classList.add("target");
    const player = checkersState.players.find((item) => item.row === cell.row && item.index === cell.index);
    if (player) {
      const disk = document.createElement("span");
      disk.className = `checker-piece ${player.color}`;
      disk.title = player.name;
      hole.appendChild(disk);
    }
    hole.addEventListener("click", () => clickChecker(cell.row, cell.index));
    checkersBoard.appendChild(hole);
  });
}

window.render_game_to_text = () => JSON.stringify(checkersState);
window.advanceTime = () => renderCheckers();
renderCheckers();
