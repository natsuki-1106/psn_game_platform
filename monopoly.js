const monopolyCells = [
  { name: "起点", type: "corner", action: "start", flag: "GO", label: "GO" },
  { name: "巴西", type: "property", price: 120, rent: 30, group: "teal", code: "BR" },
  { name: "机会", type: "chance", flag: "?" },
  { name: "阿根廷", type: "property", price: 140, rent: 35, group: "teal", code: "AR" },
  { name: "关税", type: "tax", fee: 100, flag: "$" },
  { name: "南美航线", type: "station", price: 200, rent: 45, flag: "AIR" },
  { name: "埃及", type: "property", price: 180, rent: 45, group: "pink", code: "EG" },
  { name: "命运", type: "chance", flag: "*" },
  { name: "南非", type: "property", price: 200, rent: 55, group: "pink", code: "ZA" },
  { name: "摩洛哥", type: "property", price: 220, rent: 60, group: "pink", code: "MA" },
  { name: "探监", type: "corner", action: "visit", flag: "IN" },
  { name: "西班牙", type: "property", price: 240, rent: 70, group: "blue", code: "ES" },
  { name: "电力公司", type: "utility", price: 160, rent: 50, flag: "ELE" },
  { name: "法国", type: "property", price: 260, rent: 75, group: "blue", code: "FR" },
  { name: "德国", type: "property", price: 280, rent: 80, group: "blue", code: "DE" },
  { name: "欧洲航线", type: "station", price: 200, rent: 45, flag: "AIR" },
  { name: "意大利", type: "property", price: 300, rent: 90, group: "orange", code: "IT" },
  { name: "机会", type: "chance", flag: "?" },
  { name: "英国", type: "property", price: 320, rent: 95, group: "orange", code: "GB" },
  { name: "瑞士", type: "property", price: 340, rent: 100, group: "orange", code: "CH" },
  { name: "免费停车", type: "corner", action: "parking", flag: "P" },
  { name: "土耳其", type: "property", price: 360, rent: 110, group: "green", code: "TR" },
  { name: "命运", type: "chance", flag: "*" },
  { name: "印度", type: "property", price: 380, rent: 115, group: "green", code: "IN" },
  { name: "新加坡", type: "property", price: 400, rent: 125, group: "green", code: "SG" },
  { name: "亚洲航线", type: "station", price: 200, rent: 45, flag: "AIR" },
  { name: "韩国", type: "property", price: 420, rent: 135, group: "gold", code: "KR" },
  { name: "水务公司", type: "utility", price: 160, rent: 50, flag: "WTR" },
  { name: "日本", type: "property", price: 440, rent: 145, group: "gold", code: "JP" },
  { name: "中国", type: "property", price: 460, rent: 155, group: "gold", code: "CN" },
  { name: "进监狱", type: "corner", action: "jail", flag: "J" },
  { name: "澳大利亚", type: "property", price: 480, rent: 165, group: "red", code: "AU" },
  { name: "新西兰", type: "property", price: 500, rent: 175, group: "red", code: "NZ" },
  { name: "机会", type: "chance", flag: "?" },
  { name: "加拿大", type: "property", price: 520, rent: 185, group: "red", code: "CA" },
  { name: "北美航线", type: "station", price: 200, rent: 45, flag: "AIR" },
  { name: "美国", type: "property", price: 560, rent: 200, group: "black", code: "US" },
  { name: "奢侈税", type: "tax", fee: 160, flag: "$" },
  { name: "墨西哥", type: "property", price: 580, rent: 220, group: "black", code: "MX" },
  { name: "世界银行", type: "property", price: 600, rent: 240, group: "black", flag: "BANK" },
];

const colors = ["red", "blue", "green", "gold"];
const monopolyState = {
  players: [],
  turn: 0,
  dice: 0,
  started: false,
  over: false,
  room: null,
  pendingPurchase: null,
  status: "",
};

const monopolyBoard = document.querySelector("#monopolyBoard");
const monopolyTurn = document.querySelector("#monopolyTurn");
const monopolyStats = document.querySelector("#monopolyStats");
const monopolyLog = document.querySelector("#monopolyLog");
const monopolyPlayerCount = document.querySelector("#monopolyPlayerCount");
const monopolyCenterTitle = document.querySelector("#monopolyCenterTitle");
const monopolyCenterText = document.querySelector("#monopolyCenterText");
const monopolyDice = document.querySelector("#monopolyDice");
const monopolyRoomBadge = document.querySelector("#monopolyRoomBadge");
const monopolyBuyActions = document.querySelector("#monopolyBuyActions");
const buyPropertyBtn = document.querySelector("#buyPropertyBtn");
const skipPropertyBtn = document.querySelector("#skipPropertyBtn");

document.querySelector("#startMonopolyBtn").addEventListener("click", startMonopoly);
document.querySelector("#rollMonopolyBtn").addEventListener("click", rollMonopoly);
document.querySelector("#resetMonopolyBtn").addEventListener("click", startMonopoly);
buyPropertyBtn.addEventListener("click", () => resolvePurchase(true));
skipPropertyBtn.addEventListener("click", () => resolvePurchase(false));

const roomApi = window.initRoomPanel({
  gameKey: "monopoly",
  prefix: "DF",
  getSnapshot: () => ({
    ...monopolyState,
    cells: monopolyCells.map((cell) => ({ owner: cell.owner, houses: cell.houses || 0 })),
  }),
  onRemoteState(snapshot) {
    monopolyState.players = snapshot.players || [];
    monopolyState.turn = snapshot.turn || 0;
    monopolyState.dice = snapshot.dice || 0;
    monopolyState.started = Boolean(snapshot.started);
    monopolyState.over = Boolean(snapshot.over);
    monopolyState.pendingPurchase = snapshot.pendingPurchase || null;
    monopolyState.status = snapshot.status || "";
    monopolyCells.forEach((cell, index) => {
      cell.owner = snapshot.cells?.[index]?.owner;
      cell.houses = snapshot.cells?.[index]?.houses || 0;
    });
    renderMonopoly();
  },
  onRoomChange(room) {
    monopolyState.room = room;
    monopolyRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

function syncMonopoly() {
  roomApi.broadcast({
    ...monopolyState,
    cells: monopolyCells.map((cell) => ({ owner: cell.owner, houses: cell.houses || 0 })),
  });
}

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
    delete cell.houses;
  });

  monopolyState.turn = 0;
  monopolyState.dice = 0;
  monopolyState.started = true;
  monopolyState.over = false;
  monopolyState.pendingPurchase = null;
  monopolyState.status = `${count} 人大富翁开始`;
  monopolyLog.textContent = `${count} 人全球地产局开始。`;
  monopolyCenterTitle.textContent = "环球开局";
  monopolyCenterText.textContent = "掷骰后由当前玩家决定是否购买地块。";
  renderMonopoly();
  syncMonopoly();
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
      owner.textContent = "⌂";
      div.appendChild(owner);

      const houses = document.createElement("div");
      houses.className = "house-row";
      for (let i = 0; i < Math.max(1, cell.houses || 1); i += 1) {
        const house = document.createElement("span");
        house.className = `house-mark ${monopolyState.players[cell.owner]?.color || ""}`;
        house.textContent = "⌂";
        houses.appendChild(house);
      }
      div.appendChild(houses);
    }

    const row = document.createElement("div");
    row.className = "piece-row";
    monopolyState.players.forEach((player) => {
      if (player.pos === index) {
        const piece = document.createElement("span");
        piece.className = `piece-dot player-token ${player.color}`;
        piece.textContent = player.name.slice(-1);
        row.appendChild(piece);
      }
    });
    div.appendChild(row);
    monopolyBoard.appendChild(div);
  });

  monopolyTurn.textContent = !monopolyState.started ? "等待开始" : monopolyState.over ? "已结束" : monopolyState.players[monopolyState.turn].name;
  monopolyDice.textContent = monopolyState.dice || "-";
  monopolyBuyActions.hidden = !monopolyState.pendingPurchase;
  if (monopolyState.status) monopolyCenterText.textContent = monopolyState.status;

  monopolyStats.innerHTML = "";
  monopolyState.players.forEach((player) => {
    const stat = document.createElement("div");
    stat.className = "asset-card";
    stat.innerHTML = `
      <span class="piece-dot player-token ${player.color}">${player.name.slice(-1)}</span>
      <strong>${player.name}</strong>
      <span>$${player.money}</span>
      <small>${player.properties.length} 块地产</small>
    `;

    const properties = document.createElement("div");
    properties.className = "chip-list monopoly-property-list";
    (player.properties.length ? player.properties : ["暂无房产"]).forEach((name) => {
      const chip = document.createElement("span");
      chip.className = `property-chip ${player.color}`;
      chip.textContent = name;
      properties.appendChild(chip);
    });
    stat.appendChild(properties);
    monopolyStats.appendChild(stat);
  });
}

function rollMonopoly() {
  if (!monopolyState.started || monopolyState.over) return;
  if (monopolyState.pendingPurchase) {
    monopolyLog.textContent = "请先决定是否购买当前地块。";
    renderMonopoly();
    return;
  }

  const player = monopolyState.players[monopolyState.turn];
  const dice = Math.floor(Math.random() * 6) + 1;
  monopolyState.dice = dice;

  if (player.jailed > 0) {
    player.jailed -= 1;
    monopolyLog.textContent = `${player.name} 本回合停留监狱。`;
    monopolyState.status = `${player.name} 本回合停留监狱`;
    nextTurn();
    renderMonopoly();
    syncMonopoly();
    return;
  }

  const old = player.pos;
  player.pos = (player.pos + dice) % monopolyCells.length;
  if (old + dice >= monopolyCells.length) player.money += 200;

  const result = resolveCell(player, monopolyCells[player.pos]);
  if (player.money < 0) {
    monopolyState.over = true;
    monopolyLog.textContent = `${player.name} 破产，游戏结束。`;
    monopolyState.status = `${player.name} 破产，游戏结束`;
  } else if (result !== "pending-purchase") {
    nextTurn();
  }
  renderMonopoly();
  syncMonopoly();
}

function resolveCell(player, cell) {
  if (cell.action === "jail") {
    player.pos = 10;
    player.jailed = 1;
    monopolyLog.textContent = `${player.name} 掷出 ${monopolyState.dice}，进入监狱。`;
    monopolyCenterTitle.textContent = "进监狱";
    monopolyCenterText.textContent = "下回合暂停一次。";
    monopolyState.status = `${player.name} 进入监狱`;
    return "done";
  }

  if (cell.type === "tax") {
    player.money -= cell.fee;
    monopolyLog.textContent = `${player.name} 支付 ${cell.name} $${cell.fee}。`;
    monopolyCenterTitle.textContent = cell.name;
    monopolyCenterText.textContent = `支付 $${cell.fee}`;
    monopolyState.status = `${player.name} 支付 ${cell.name} $${cell.fee}`;
    return "done";
  }

  if (cell.type === "chance") {
    const bonus = Math.random() > 0.5 ? 120 : -80;
    player.money += bonus;
    monopolyLog.textContent = `${player.name}${bonus > 0 ? " 获得奖励 " : " 支出 "} $${Math.abs(bonus)}。`;
    monopolyCenterTitle.textContent = cell.name;
    monopolyCenterText.textContent = bonus > 0 ? "获得银行奖励。" : "临时支出。";
    monopolyState.status = `${player.name}${bonus > 0 ? " 获得 " : " 支出 "}$${Math.abs(bonus)}`;
    return "done";
  }

  if (cell.price) {
    if (cell.owner === undefined && player.money >= cell.price) {
      monopolyState.pendingPurchase = { playerIndex: monopolyState.turn, cellIndex: monopolyCells.indexOf(cell) };
      monopolyLog.textContent = `${player.name} 来到 ${cell.name}，请选择购买或跳过。`;
      monopolyCenterTitle.textContent = `${player.name} 可购买 ${cell.name}`;
      monopolyCenterText.textContent = `售价 $${cell.price}，租金 $${cell.rent}`;
      monopolyState.status = `${player.name} 正在决定是否购买 ${cell.name}`;
      return "pending-purchase";
    }

    if (cell.owner !== undefined && monopolyState.players[cell.owner] !== player) {
      const owner = monopolyState.players[cell.owner];
      const rent = cell.rent + (cell.houses || 0) * 25;
      player.money -= rent;
      owner.money += rent;
      monopolyLog.textContent = `${player.name} 向 ${owner.name} 支付 ${cell.name} 租金 $${rent}。`;
      monopolyCenterTitle.textContent = "支付租金";
      monopolyCenterText.textContent = `${cell.name} 租金 $${rent}`;
      monopolyState.status = `${player.name} 向 ${owner.name} 支付 $${rent}`;
      return "done";
    }

    monopolyLog.textContent = `${player.name} 来到自己的 ${cell.name}。`;
    monopolyCenterTitle.textContent = cell.name;
    monopolyCenterText.textContent = "自有地块。";
    monopolyState.status = `${player.name} 回到自己的 ${cell.name}`;
    return "done";
  }

  monopolyLog.textContent = `${player.name} 来到 ${cell.name}。`;
  monopolyCenterTitle.textContent = cell.name;
  monopolyCenterText.textContent = "安全停留。";
  monopolyState.status = `${player.name} 停在 ${cell.name}`;
  return "done";
}

function resolvePurchase(shouldBuy) {
  if (!monopolyState.pendingPurchase) return;

  const { playerIndex, cellIndex } = monopolyState.pendingPurchase;
  const player = monopolyState.players[playerIndex];
  const cell = monopolyCells[cellIndex];
  if (!player || !cell) return;

  if (shouldBuy && cell.owner === undefined && player.money >= cell.price) {
    cell.owner = playerIndex;
    cell.houses = 1;
    player.money -= cell.price;
    if (!player.properties.includes(cell.name)) player.properties.push(cell.name);
    monopolyLog.textContent = `${player.name} 购买了 ${cell.name}。`;
    monopolyCenterTitle.textContent = `${player.name} 买入 ${cell.name}`;
    monopolyCenterText.textContent = `已支付 $${cell.price}`;
    monopolyState.status = `${player.name} 买下 ${cell.name}`;
  } else {
    monopolyLog.textContent = `${player.name} 放弃购买 ${cell.name}。`;
    monopolyCenterTitle.textContent = `${player.name} 放弃购买`;
    monopolyCenterText.textContent = `${cell.name} 暂时无人持有`;
    monopolyState.status = `${player.name} 放弃购买 ${cell.name}`;
  }

  monopolyState.pendingPurchase = null;
  if (!monopolyState.over) nextTurn();
  renderMonopoly();
  syncMonopoly();
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
