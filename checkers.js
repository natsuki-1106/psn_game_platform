const checkersBoard = document.querySelector("#checkersBoard");
const checkersTurn = document.querySelector("#checkersTurn");
const checkersLog = document.querySelector("#checkersLog");
document.querySelector("#resetCheckersBtn").addEventListener("click", resetCheckers);

const checkersState = {
  board: [],
  turn: "red",
  selected: null,
  targets: [],
  over: false,
};

function resetCheckers() {
  checkersState.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 8; c += 1) if ((r + c) % 2 === 1) checkersState.board[r][c] = { color: "blue", king: false };
  }
  for (let r = 5; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) if ((r + c) % 2 === 1) checkersState.board[r][c] = { color: "red", king: false };
  }
  checkersState.turn = "red";
  checkersState.selected = null;
  checkersState.targets = [];
  checkersState.over = false;
  checkersLog.textContent = "点击己方棋子，再点击高亮目标格。";
  renderCheckers();
}

function dirsFor(piece) {
  const forward = piece.color === "red" ? -1 : 1;
  const dirs = [
    [forward, -1],
    [forward, 1],
  ];
  if (piece.king) dirs.push([-forward, -1], [-forward, 1]);
  return dirs;
}

function legalTargets(row, col) {
  const piece = checkersState.board[row][col];
  if (!piece) return [];
  const targets = [];
  dirsFor(piece).forEach(([dr, dc]) => {
    const r1 = row + dr;
    const c1 = col + dc;
    const r2 = row + dr * 2;
    const c2 = col + dc * 2;
    if (inside(r1, c1) && !checkersState.board[r1][c1]) targets.push({ row: r1, col: c1, capture: null });
    if (
      inside(r2, c2) &&
      checkersState.board[r1]?.[c1] &&
      checkersState.board[r1][c1].color !== piece.color &&
      !checkersState.board[r2][c2]
    ) {
      targets.push({ row: r2, col: c2, capture: { row: r1, col: c1 } });
    }
  });
  return targets;
}

function inside(row, col) {
  return row >= 0 && col >= 0 && row < 8 && col < 8;
}

function clickChecker(row, col) {
  if (checkersState.over) return;
  const selectedTarget = checkersState.targets.find((target) => target.row === row && target.col === col);
  if (checkersState.selected && selectedTarget) {
    moveChecker(selectedTarget);
    return;
  }

  const piece = checkersState.board[row][col];
  if (!piece || piece.color !== checkersState.turn) return;
  checkersState.selected = { row, col };
  checkersState.targets = legalTargets(row, col);
  renderCheckers();
}

function moveChecker(target) {
  const { row, col } = checkersState.selected;
  const piece = checkersState.board[row][col];
  checkersState.board[row][col] = null;
  checkersState.board[target.row][target.col] = piece;
  if (target.capture) checkersState.board[target.capture.row][target.capture.col] = null;
  if ((piece.color === "red" && target.row === 0) || (piece.color === "blue" && target.row === 7)) piece.king = true;
  checkersState.selected = null;
  checkersState.targets = [];

  const next = piece.color === "red" ? "blue" : "red";
  const hasOpponent = checkersState.board.flat().some((p) => p && p.color === next);
  if (!hasOpponent) {
    checkersState.over = true;
    checkersLog.textContent = `${piece.color === "red" ? "红方" : "蓝方"}获胜！`;
  } else {
    checkersState.turn = next;
    checkersLog.textContent = `轮到${next === "red" ? "红方" : "蓝方"}。`;
  }
  renderCheckers();
}

function renderCheckers() {
  checkersBoard.innerHTML = "";
  checkersTurn.textContent = checkersState.over ? "已结束" : checkersState.turn === "red" ? "红方" : "蓝方";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `checker-cell ${(row + col) % 2 === 1 ? "dark-square" : "light-square"}`;
      if (checkersState.selected?.row === row && checkersState.selected?.col === col) cell.classList.add("selected");
      if (checkersState.targets.some((target) => target.row === row && target.col === col)) cell.classList.add("target");
      const piece = checkersState.board[row][col];
      if (piece) {
        const disk = document.createElement("span");
        disk.className = `checker-piece ${piece.color}${piece.king ? " king" : ""}`;
        cell.appendChild(disk);
      }
      cell.addEventListener("click", () => clickChecker(row, col));
      checkersBoard.appendChild(cell);
    }
  }
}

window.render_game_to_text = () => JSON.stringify(checkersState);
window.advanceTime = () => renderCheckers();
resetCheckers();
