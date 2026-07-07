const monopolyCells = [
  { name: "起点", type: "corner", action: "start", flag: "🌐", label: "GO" },
  { name: "巴西", type: "property", price: 120, rent: 30, group: "teal", code: "BR" },
  { name: "机会", type: "chance", flag: "🎲" },
  { name: "阿根廷", type: "property", price: 140, rent: 35, group: "teal", code: "AR" },
  { name: "关税", type: "tax", fee: 100, flag: "🧾" },
  { name: "南美航线", type: "station", price: 200, rent: 45, flag: "✈️" },
  { name: "埃及", type: "property", price: 180, rent: 45, group: "pink", code: "EG" },
  { name: "命运", type: "chance", flag: "✨" },
  { name: "南非", type: "property", price: 200, rent: 55, group: "pink", code: "ZA" },
  { name: "摩洛哥", type: "property", price: 220, rent: 60, group: "pink", code: "MA" },
  { name: "探监", type: "corner", action: "visit", flag: "🧭" },
  { name: "西班牙", type: "property", price: 240, rent: 70, group: "blue", code: "ES" },
  { name: "电力公司", type: "utility", price: 160, rent: 50, flag: "⚡" },
  { name: "法国", type: "property", price: 260, rent: 75, group: "blue", code: "FR" },
  { name: "德国", type: "property", price: 280, rent: 80, group: "blue", code: "DE" },
  { name: "欧洲航线", type: "station", price: 200, rent: 45, flag: "✈️" },
  { name: "意大利", type: "property", price: 300, rent: 90, group: "orange", code: "IT" },
  { name: "机会", type: "chance", flag: "🎲" },
  { name: "英国", type: "property", price: 320, rent: 95, group: "orange", code: "GB" },
  { name: "瑞士", type: "property", price: 340, rent: 100, group: "orange", code: "CH" },
  { name: "免费停车", type: "corner", action: "parking", flag: "🅿️" },
  { name: "土耳其", type: "property", price: 360, rent: 110, group: "green", code: "TR" },
  { name: "命运", type: "chance", flag: "✨" },
  { name: "印度", type: "property", price: 380, rent: 115, group: "green", code: "IN" },
  { name: "新加坡", type: "property", price: 400, rent: 125, group: "green", code: "SG" },
  { name: "亚洲航线", type: "station", price: 200, rent: 45, flag: "✈️" },
  { name: "韩国", type: "property", price: 420, rent: 135, group: "gold", code: "KR" },
  { name: "水务公司", type: "utility", price: 160, rent: 50, flag: "💧" },
  { name: "日本", type: "property", price: 440, rent: 145, group: "gold", code: "JP" },
  { name: "中国", type: "property", price: 460, rent: 155, group: "gold", code: "CN" },
  { name: "进监狱", type: "corner", action: "jail", flag: "🚓" },
  { name: "澳大利亚", type: "property", price: 480, rent: 165, group: "red", code: "AU" },
  { name: "新西兰", type: "property", price: 500, rent: 175, group: "red", code: "NZ" },
  { name: "机会", type: "chance", flag: "🎲" },
  { name: "加拿大", type: "property", price: 520, rent: 185, group: "red", code: "CA" },
  { name: "北美航线", type: "station", price: 200, rent: 45, flag: "✈️" },
  { name: "美国", type: "property", price: 560, rent: 200, group: "black", code: "US" },
  { name: "奢侈税", type: "tax", fee: 160, flag: "💳" },
  { name: "墨西哥", type: "property", price: 580, rent: 220, group: "black", code: "MX" },
  { name: "世界银行", type: "property", price: 600, rent: 240, group: "black", flag: "🏦" },
];

const colors = ["red", "blue", "green", "gold"];
const monopolyState = { players: [], turn: 0, dice: 0, started: false, over: false, room: null };
let roomApi = null;

const monopolyBoard = document.querySelector("#monopolyBoard");
const monopolyTurn = document.querySelector("#monopolyTurn");
const monopolyStats = document.querySelector("#monopolyStats");
const monopolyLog = document.querySelector("#monopolyLog");
const monopolyPlayerCount = document.querySelector("#monopolyPlayerCount");
const monopolyCenterTitle = document.querySelector("#monopolyCenterTitle");
const monopolyCenterText = document.querySelector("#monopolyCenterText");
const monopolyDice = document.querySelector("#monopolyDice");
const monopolyRoomBadge = document.querySelector("#monopolyRoomBadge");
document.querySelector("#startMonopolyBtn").addEventListener("click", startMonopoly);
document.querySelector("#rollMonopolyBtn").addEventListener("click", rollMonopoly);
document.querySelector("#resetMonopolyBtn").addEventListener("click", startMonopoly);

roomApi = window.initRoomPanel({
  gameKey: "monopoly",
  prefix: "DF",
  onRoomChange(room) {
    monopolyState.room = room;
    monopolyRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

function startMonopoly() {
  const blocked = roomApi.requireHost();
  if (blocked) {
    monopolyLog.textContent = blocked;
    renderMonopoly();
    return;
  }

  const count = Number(monopolyPlayerCount.value);
  monopolyState.players = Array.from({ length: count }, (_, index) => ({
    name: `玩家 ${String.fromCharCode(65 + index)}`,
    pos: 0,
    money: 1500,
    color: colors[index],
    properties: [],
    jailed: 0,
  }));
  monopolyCells.forEach((cell) => {
    delete cell.owner;
  });
  monopolyState.turn = 0;
  monopolyState.dice = 0;
  monopolyState.started = true;
  monopolyState.over = false;
  monopolyLog.textContent = `${count} 人环球地产局开始。`;
  monopolyCenterTitle.textContent = "环球开局";
  monopolyCenterText.textContent = "按标准 40 格大富翁路线行动，国家地块显示国旗与价格。";
  renderMonopoly();
}

function cellPosition(index) {
  if (index <= 10) return { row: 11, col: 11 - index };
  if (index <= 20) return { row: 21 - index, col: 1 };
  if (index <= 30) return { row: 1, col: index - 19 };
  return { row: index - 29, col: 11 };
}

function renderMonopoly() {
  monopolyBoard.querySelectorAll(".monopoly-cell").forEach((node) => node.remove());

  monopolyCells.forEach((cell, index) => {
    const pos = cellPosition(index);
    const div = document.createElement("button");
    div.type = "button";
    div.className = `monopoly-cell ${cell.type} ${cell.group || ""}`;
    div.style.gridRow = pos.row;
    div.style.gridColumn = pos.col;
    div.innerHTML = `
      <span class="cell-index">${String(index).padStart(2, "0")}</span>
      ${countryFlagHtml(cell)}
      <strong>${cell.name}</strong>
      <small>${cell.price ? `$${cell.price}` : cell.fee ? `-$${cell.fee}` : cell.label || cell.type}</small>
    `;
    if (typeof cell.owner === "number") {
      const owner = document.createElement("span");
      owner.className = `owner-mark ${monopolyState.players[cell.owner]?.color || ""}`;
      div.appendChild(owner);
    }
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
  monopolyDice.textContent = monopolyState.dice || "-";
  monopolyStats.innerHTML = "";
  monopolyState.players.forEach((player) => {
    const stat = document.createElement("div");
    stat.className = "asset-card";
    stat.innerHTML = `
      <span class="piece-dot ${player.color}">${player.name.slice(-1)}</span>
      <strong>${player.name}</strong>
      <span>$${player.money}</span>
      <small>${player.properties.length} 块地</small>
    `;
    monopolyStats.appendChild(stat);
  });
}

function rollMonopoly() {
  if (!monopolyState.started || monopolyState.over) return;
  const player = monopolyState.players[monopolyState.turn];
  const dice = Math.floor(Math.random() * 6) + 1;
  monopolyState.dice = dice;

  if (player.jailed > 0) {
    player.jailed -= 1;
    monopolyLog.textContent = `${player.name} 本回合停留监狱。`;
    nextTurn();
    renderMonopoly();
    return;
  }

  const old = player.pos;
  player.pos = (player.pos + dice) % monopolyCells.length;
  if (old + dice >= monopolyCells.length) player.money += 200;
  resolveCell(player, monopolyCells[player.pos]);
  if (player.money < 0) {
    monopolyState.over = true;
    monopolyLog.textContent = `${player.name} 破产，游戏结束。`;
  } else {
    nextTurn();
  }
  renderMonopoly();
}

function resolveCell(player, cell) {
  if (cell.action === "jail") {
    player.pos = 10;
    player.jailed = 1;
    monopolyLog.textContent = `${player.name} 掷出 ${monopolyState.dice}，进入监狱。`;
    monopolyCenterTitle.textContent = "进监狱";
    monopolyCenterText.textContent = "下回合暂停一次。";
    return;
  }

  if (cell.type === "tax") {
    player.money -= cell.fee;
    monopolyLog.textContent = `${player.name} 缴纳 ${cell.name} $${cell.fee}。`;
    monopolyCenterTitle.textContent = cell.name;
    monopolyCenterText.textContent = `支付 $${cell.fee}`;
    return;
  }

  if (cell.type === "chance") {
    const bonus = Math.random() > 0.5 ? 120 : -80;
    player.money += bonus;
    monopolyLog.textContent = `${player.name} 抽到${bonus > 0 ? "奖励" : "支出"} ${Math.abs(bonus)}。`;
    monopolyCenterTitle.textContent = cell.name;
    monopolyCenterText.textContent = bonus > 0 ? "获得银行奖励。" : "临时支出。";
    return;
  }

  if (cell.price) {
    if (cell.owner === undefined && player.money >= cell.price) {
      cell.owner = monopolyState.players.indexOf(player);
      player.money -= cell.price;
      player.properties.push(cell.name);
      monopolyLog.textContent = `${player.name} 买入 ${cell.name}。`;
      monopolyCenterTitle.textContent = cell.name;
      monopolyCenterText.textContent = `买入价格 $${cell.price}，租金 $${cell.rent}`;
    } else if (cell.owner !== undefined && monopolyState.players[cell.owner] !== player) {
      const owner = monopolyState.players[cell.owner];
      player.money -= cell.rent;
      owner.money += cell.rent;
      monopolyLog.textContent = `${player.name} 向 ${owner.name} 支付 ${cell.name} 租金 $${cell.rent}。`;
      monopolyCenterTitle.textContent = "支付租金";
      monopolyCenterText.textContent = `${cell.name} 租金 $${cell.rent}`;
    } else {
      monopolyLog.textContent = `${player.name} 来到自己的 ${cell.name}。`;
      monopolyCenterTitle.textContent = cell.name;
      monopolyCenterText.textContent = "自有地块。";
    }
    return;
  }

  monopolyLog.textContent = `${player.name} 来到 ${cell.name}。`;
  monopolyCenterTitle.textContent = cell.name;
  monopolyCenterText.textContent = "安全停留。";
}

function nextTurn() {
  monopolyState.turn = (monopolyState.turn + 1) % monopolyState.players.length;
}

function countryFlagHtml(cell) {
  if (cell.code) {
    return `<span class="country-flag flag-${cell.code.toLowerCase()}" aria-label="${cell.name}国旗"><i>${cell.code}</i></span>`;
  }
  return `<span class="country-symbol">${cell.flag || ""}</span>`;
}

window.render_game_to_text = () => JSON.stringify(monopolyState);
window.advanceTime = () => renderMonopoly();
renderMonopoly();
