const monopolyCells = [
  { name: "起点", type: "start" },
  { name: "书店", type: "gold", value: 80 },
  { name: "机会", type: "jump", value: 2 },
  { name: "税务", type: "tax", value: -60 },
  { name: "咖啡馆", type: "gold", value: 90 },
  { name: "公园", type: "gold", value: 70 },
  { name: "罚款", type: "tax", value: -80 },
  { name: "车站", type: "jump", value: 3 },
  { name: "商场", type: "gold", value: 120 },
  { name: "医院", type: "tax", value: -100 },
  { name: "银行", type: "gold", value: 150 },
  { name: "终点", type: "start" },
];

const colors = ["red", "blue", "green", "gold", "purple", "orange"];
const monopolyState = { players: [], turn: 0, dice: 0, started: false, over: false };

const monopolyBoard = document.querySelector("#monopolyBoard");
const monopolyTurn = document.querySelector("#monopolyTurn");
const monopolyStats = document.querySelector("#monopolyStats");
const monopolyLog = document.querySelector("#monopolyLog");
const monopolyPlayerCount = document.querySelector("#monopolyPlayerCount");
document.querySelector("#startMonopolyBtn").addEventListener("click", startMonopoly);
document.querySelector("#rollMonopolyBtn").addEventListener("click", rollMonopoly);
document.querySelector("#resetMonopolyBtn").addEventListener("click", startMonopoly);

function startMonopoly() {
  const count = Number(monopolyPlayerCount.value);
  monopolyState.players = Array.from({ length: count }, (_, index) => ({
    name: `玩家 ${String.fromCharCode(65 + index)}`,
    pos: 0,
    money: 1000,
    color: colors[index],
  }));
  monopolyState.turn = 0;
  monopolyState.dice = 0;
  monopolyState.started = true;
  monopolyState.over = false;
  monopolyLog.textContent = `${count} 人游戏开始，先到终点者获胜。`;
  renderMonopoly();
}

function renderMonopoly() {
  monopolyBoard.innerHTML = "";
  monopolyCells.forEach((cell, index) => {
    const div = document.createElement("div");
    div.className = `track-cell ${cell.type}`;
    div.innerHTML = `<strong>${index}. ${cell.name}</strong>`;
    const row = document.createElement("div");
    row.className = "piece-row";
    monopolyState.players.forEach((player) => {
      if (player.pos === index) {
        const piece = document.createElement("span");
        piece.className = `piece-dot ${player.color}`;
        piece.textContent = player.name.slice(-1);
        row.appendChild(piece);
      }
    });
    div.appendChild(row);
    monopolyBoard.appendChild(div);
  });

  monopolyTurn.textContent = !monopolyState.started ? "等待开始" : monopolyState.over ? "已结束" : monopolyState.players[monopolyState.turn].name;
  monopolyStats.innerHTML = "";
  monopolyState.players.forEach((player) => {
    const stat = document.createElement("span");
    stat.className = `piece-dot ${player.color}`;
    stat.textContent = `${player.name} $${player.money}`;
    monopolyStats.appendChild(stat);
  });
}

function rollMonopoly() {
  if (!monopolyState.started || monopolyState.over) return;
  const player = monopolyState.players[monopolyState.turn];
  const dice = Math.floor(Math.random() * 6) + 1;
  monopolyState.dice = dice;
  player.pos += dice;

  if (player.pos >= monopolyCells.length - 1) {
    player.pos = monopolyCells.length - 1;
    player.money += 300;
    monopolyState.over = true;
    monopolyLog.textContent = `${player.name} 掷出 ${dice}，到达终点，获胜！`;
    renderMonopoly();
    return;
  }

  const cell = monopolyCells[player.pos];
  if (cell.type === "gold" || cell.type === "tax") player.money += cell.value;
  if (cell.type === "jump") player.pos = Math.min(monopolyCells.length - 1, player.pos + cell.value);

  monopolyLog.textContent = `${player.name} 掷出 ${dice}，停在 ${cell.name}。`;
  monopolyState.turn = (monopolyState.turn + 1) % monopolyState.players.length;
  renderMonopoly();
}

window.render_game_to_text = () => JSON.stringify(monopolyState);
window.advanceTime = () => renderMonopoly();
startMonopoly();
