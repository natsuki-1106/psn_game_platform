const checkersBoard = document.querySelector("#checkersBoard");
const checkersTurn = document.querySelector("#checkersTurn");
const checkersLog = document.querySelector("#checkersLog");
const checkersPlayerCount = document.querySelector("#checkersPlayerCount");
const checkersRoomBadge = document.querySelector("#checkersRoomBadge");
let checkersRoomApi = null;
document.querySelector("#startCheckersBtn").addEventListener("click", startCheckers);
document.querySelector("#resetCheckersBtn").addEventListener("click", startCheckers);

const checkersColors = ["red", "blue", "green", "gold", "purple", "orange"];
const starts = [
  { row: 7, col: 0, target: { row: 0, col: 7 } },
  { row: 0, col: 7, target: { row: 7, col: 0 } },
  { row: 7, col: 7, target: { row: 0, col: 0 } },
  { row: 0, col: 0, target: { row: 7, col: 7 } },
  { row: 4, col: 0, target: { row: 3, col: 7 } },
  { row: 3, col: 7, target: { row: 4, col: 0 } },
];

const checkersState = {
  players: [],
  turn: 0,
  selected: false,
  targets: [],
  started: false,
  over: false,
};

checkersRoomApi = window.initRoomPanel({
  gameKey: "checkers",
  prefix: "TQ",
  onRoomChange(room) {
    checkersState.room = room;
    checkersRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

function startCheckers() {
  const blocked = checkersRoomApi.requireHost();
  if (blocked) {
    checkersLog.textContent = blocked;
    renderCheckers();
    return;
  }
  const count = Number(checkersPlayerCount.value);
  checkersState.players = Array.from({ length: count }, (_, index) => ({
    name: `玩家 ${String.fromCharCode(65 + index)}`,
    color: checkersColors[index],
    row: starts[index].row,
    col: starts[index].col,
    target: starts[index].target,
  }));
  checkersState.turn = 0;
  checkersState.selected = false;
  checkersState.targets = [];
  checkersState.started = true;
  checkersState.over = false;
  checkersLog.textContent = `${count} 人跳棋开始。点击当前玩家棋子，再点击目标格。`;
  renderCheckers();
}

function occupied(row, col) {
  return checkersState.players.some((player) => player.row === row && player.col === col);
}

function currentPlayer() {
  return checkersState.players[checkersState.turn];
}

function legalTargets(player) {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const targets = [];
  dirs.forEach(([dr, dc]) => {
    const r1 = player.row + dr;
    const c1 = player.col + dc;
    const r2 = player.row + dr * 2;
    const c2 = player.col + dc * 2;
    if (inside(r1, c1) && !occupied(r1, c1)) targets.push({ row: r1, col: c1 });
    if (inside(r2, c2) && occupied(r1, c1) && !occupied(r2, c2)) targets.push({ row: r2, col: c2 });
  });
  return targets;
}

function inside(row, col) {
  return row >= 0 && col >= 0 && row < 8 && col < 8;
}

function clickChecker(row, col) {
  if (!checkersState.started || checkersState.over) return;
  const player = currentPlayer();
  if (player.row === row && player.col === col) {
    checkersState.selected = true;
    checkersState.targets = legalTargets(player);
    renderCheckers();
    return;
  }
  const target = checkersState.targets.find((item) => item.row === row && item.col === col);
  if (!checkersState.selected || !target) return;
  player.row = target.row;
  player.col = target.col;
  checkersState.selected = false;
  checkersState.targets = [];
  if (player.row === player.target.row && player.col === player.target.col) {
    checkersState.over = true;
    checkersLog.textContent = `${player.name} 到达目标点，获胜！`;
  } else {
    checkersState.turn = (checkersState.turn + 1) % checkersState.players.length;
    checkersLog.textContent = `轮到 ${currentPlayer().name}。`;
  }
  renderCheckers();
}

function renderCheckers() {
  checkersBoard.innerHTML = "";
  checkersTurn.textContent = !checkersState.started ? "等待开始" : checkersState.over ? "已结束" : currentPlayer().name;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `checker-cell ${(row + col) % 2 === 1 ? "dark-square" : "light-square"}`;
      if (checkersState.targets.some((target) => target.row === row && target.col === col)) cell.classList.add("target");
      const player = checkersState.players.find((item) => item.row === row && item.col === col);
      if (player) {
        const disk = document.createElement("span");
        disk.className = `checker-piece ${player.color}`;
        disk.title = player.name;
        cell.appendChild(disk);
      }
      cell.addEventListener("click", () => clickChecker(row, col));
      checkersBoard.appendChild(cell);
    }
  }
}

window.render_game_to_text = () => JSON.stringify(checkersState);
window.advanceTime = () => renderCheckers();
renderCheckers();
