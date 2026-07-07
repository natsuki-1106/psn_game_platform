const ludoCells = Array.from({ length: 24 }, (_, index) => ({ name: index === 0 ? "机场" : index === 23 ? "终点" : `航道 ${index}` }));
const teamColors = ["red", "blue", "green", "gold"];
const teamNames = ["红方", "蓝方", "绿方", "黄方"];
const ludoState = { teams: [], turn: 0, dice: 0, started: false, over: false };

const ludoBoard = document.querySelector("#ludoBoard");
const ludoTurn = document.querySelector("#ludoTurn");
const ludoPieces = document.querySelector("#ludoPieces");
const ludoLog = document.querySelector("#ludoLog");
const ludoPlayerCount = document.querySelector("#ludoPlayerCount");
document.querySelector("#startLudoBtn").addEventListener("click", startLudo);
document.querySelector("#rollLudoBtn").addEventListener("click", rollLudo);
document.querySelector("#resetLudoBtn").addEventListener("click", startLudo);

function startLudo() {
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
  ludoCells.forEach((cell, index) => {
    const div = document.createElement("div");
    div.className = `track-cell ${index === 0 ? "start" : index === 23 ? "gold" : ""}`;
    div.innerHTML = `<strong>${index}. ${cell.name}</strong>`;
    const row = document.createElement("div");
    row.className = "piece-row";
    ludoState.teams.forEach((team) => {
      team.pieces.forEach((pos, pieceIndex) => {
        if (pos === index) {
          const piece = document.createElement("span");
          piece.className = `piece-dot ${team.color}`;
          piece.textContent = pieceIndex + 1;
          row.appendChild(piece);
        }
      });
    });
    div.appendChild(row);
    ludoBoard.appendChild(div);
  });

  ludoTurn.textContent = !ludoState.started ? "等待开始" : ludoState.over ? "已结束" : ludoState.teams[ludoState.turn].name;
  ludoPieces.innerHTML = "";
  ludoState.teams.forEach((team, teamIndex) => {
    team.pieces.forEach((pos, index) => {
      const piece = document.createElement("button");
      piece.className = "piece-button";
      piece.type = "button";
      piece.textContent = `${team.name}${index + 1}: ${pos < 0 ? "待起飞" : pos >= 23 ? "到达" : pos}`;
      piece.disabled = teamIndex !== ludoState.turn || ludoState.dice === 0 || ludoState.over;
      piece.addEventListener("click", () => moveLudoPiece(index));
      ludoPieces.appendChild(piece);
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
startLudo();
