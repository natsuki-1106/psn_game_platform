const ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "小王", "大王"];
const rankValue = Object.fromEntries(ranks.map((rank, index) => [rank, index]));
const suits = ["S", "H", "C", "D"];
const landlordState = {
  seats: [
    { name: "玩家 A", type: "human", hand: [] },
    { name: "玩家 B", type: "human", hand: [] },
  ],
  turn: 0,
  selected: [],
  lastPlay: null,
  passes: 0,
  started: false,
  over: false,
  room: null,
};

const landlordTurn = document.querySelector("#landlordTurn");
const landlordPlayers = document.querySelector("#landlordPlayers");
const landlordLog = document.querySelector("#landlordLog");
const landlordRoomLog = document.querySelector("#landlordRoomLog");
const landlordRoomBadge = document.querySelector("#landlordRoomBadge");
const lastPlay = document.querySelector("#lastPlay");
const addHumanBtn = document.querySelector("#addHumanBtn");
const addRobotBtn = document.querySelector("#addRobotBtn");
const hintCardsBtn = document.querySelector("#hintCardsBtn");
document.querySelector("#playCardsBtn").addEventListener("click", playSelectedCards);
document.querySelector("#passCardsBtn").addEventListener("click", passCards);
document.querySelector("#resetLandlordBtn").addEventListener("click", resetRoom);
document.querySelector("#startLandlordBtn").addEventListener("click", startLandlord);
addHumanBtn.addEventListener("click", addHuman);
addRobotBtn.addEventListener("click", addRobot);
hintCardsBtn.addEventListener("click", hintCards);

const landlordRoomApi = window.initRoomPanel({
  gameKey: "landlord",
  prefix: "DD",
  onRoomChange(room) {
    landlordState.room = room;
    landlordRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
  },
});

function addHuman() {
  const humanCount = landlordState.seats.filter((seat) => seat.type === "human").length;
  if (humanCount >= 2 || landlordState.seats.length >= 3) return;
  landlordState.seats.push({ name: `玩家 ${String.fromCharCode(65 + humanCount)}`, type: "human", hand: [] });
  renderLandlord();
}

function addRobot() {
  if (landlordState.seats.length >= 3) return;
  landlordState.seats.push({ name: "机器人", type: "robot", hand: [] });
  renderLandlord();
}

function resetRoom() {
  landlordState.seats = [
    { name: "玩家 A", type: "human", hand: [] },
    { name: "玩家 B", type: "human", hand: [] },
  ];
  landlordState.turn = 0;
  landlordState.selected = [];
  landlordState.lastPlay = null;
  landlordState.passes = 0;
  landlordState.started = false;
  landlordState.over = false;
  landlordLog.textContent = "两名真人已就位，可以启动机器人或直接开始。";
  renderLandlord();
}

function buildDeck() {
  const deck = [];
  suits.forEach((suit) => ranks.slice(0, 13).forEach((rank) => deck.push({ rank, suit, id: `${rank}${suit}` })));
  deck.push({ rank: "小王", suit: "", id: "小王" }, { rank: "大王", suit: "", id: "大王" });
  return deck.sort(() => Math.random() - 0.5);
}

function startLandlord() {
  const blocked = landlordRoomApi.requireHost();
  if (blocked) {
    landlordLog.textContent = blocked;
    renderLandlord();
    return;
  }
  while (landlordState.seats.length < 3) addRobot();
  const deck = buildDeck();
  landlordState.seats.forEach((seat) => {
    seat.hand = [];
  });
  deck.forEach((card, index) => landlordState.seats[index % 3].hand.push(card));
  landlordState.seats.forEach((seat) => sortHand(seat.hand));
  landlordState.turn = 0;
  landlordState.selected = [];
  landlordState.lastPlay = null;
  landlordState.passes = 0;
  landlordState.started = true;
  landlordState.over = false;
  landlordLog.textContent = `${landlordState.seats[0].name} 先出牌。`;
  renderLandlord();
}

function sortHand(hand) {
  hand.sort((a, b) => rankValue[a.rank] - rankValue[b.rank]);
}

function classify(cards) {
  if (!cards.length) return null;
  const values = cards.map((card) => rankValue[card.rank]).sort((a, b) => a - b);
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.values()].sort((a, b) => b - a);
  if (cards.length === 1) return { type: "single", power: values[0], count: 1 };
  if (cards.length === 2 && values.includes(rankValue["小王"]) && values.includes(rankValue["大王"])) return { type: "rocket", power: 99, count: 2 };
  if (cards.length === 2 && groups[0] === 2) return { type: "pair", power: values[0], count: 2 };
  if (cards.length === 3 && groups[0] === 3) return { type: "triple", power: values[0], count: 3 };
  if (cards.length === 4 && groups[0] === 4) return { type: "bomb", power: values[0], count: 4 };
  if (cards.length >= 5 && groups.every((count) => count === 1) && values.every((value) => value < rankValue["2"])) {
    if (values.every((value, index) => index === 0 || value === values[index - 1] + 1)) {
      return { type: "straight", power: values.at(-1), count: cards.length };
    }
  }
  return null;
}

function beats(play, last) {
  if (!play) return false;
  if (!last) return true;
  if (play.type === "rocket") return true;
  if (play.type === "bomb" && last.type !== "bomb" && last.type !== "rocket") return true;
  return play.type === last.type && play.count === last.count && play.power > last.power;
}

function findHint(hand, lastPlay) {
  const all = buildHintCandidates(hand).filter((candidate) => beats(candidate.play, lastPlay));
  all.sort((a, b) => {
    if (a.play.type === "rocket" && b.play.type !== "rocket") return 1;
    if (a.play.type !== "rocket" && b.play.type === "rocket") return -1;
    if (a.play.type === "bomb" && b.play.type !== "bomb") return 1;
    if (a.play.type !== "bomb" && b.play.type === "bomb") return -1;
    if (a.play.count !== b.play.count) return a.play.count - b.play.count;
    return a.play.power - b.play.power;
  });
  return all[0]?.indices || [];
}

function buildHintCandidates(hand) {
  const byRank = new Map();
  hand.forEach((card, index) => {
    if (!byRank.has(card.rank)) byRank.set(card.rank, []);
    byRank.get(card.rank).push(index);
  });
  const candidates = [];

  for (const indices of byRank.values()) {
    addCandidate(candidates, hand, indices.slice(0, 1));
    if (indices.length >= 2) addCandidate(candidates, hand, indices.slice(0, 2));
    if (indices.length >= 3) addCandidate(candidates, hand, indices.slice(0, 3));
    if (indices.length >= 4) addCandidate(candidates, hand, indices.slice(0, 4));
  }

  const jokerSmall = hand.findIndex((card) => card.rank === "小王");
  const jokerBig = hand.findIndex((card) => card.rank === "大王");
  if (jokerSmall >= 0 && jokerBig >= 0) addCandidate(candidates, hand, [jokerSmall, jokerBig]);

  const uniqueRanks = ranks
    .slice(0, 12)
    .filter((rank) => byRank.has(rank))
    .map((rank) => ({ rank, index: byRank.get(rank)[0], value: rankValue[rank] }));
  for (let start = 0; start < uniqueRanks.length; start += 1) {
    const run = [uniqueRanks[start]];
    for (let next = start + 1; next < uniqueRanks.length; next += 1) {
      if (uniqueRanks[next].value !== run.at(-1).value + 1) break;
      run.push(uniqueRanks[next]);
      if (run.length >= 5) addCandidate(candidates, hand, run.map((item) => item.index));
    }
  }

  return candidates;
}

function addCandidate(candidates, hand, indices) {
  const play = classify(indices.map((index) => hand[index]));
  if (play) candidates.push({ play, indices });
}

function hintCards() {
  if (!landlordState.started || landlordState.over) return;
  const player = landlordState.seats[landlordState.turn];
  if (player.type !== "human") {
    landlordLog.textContent = "当前是机器人回合。";
    return;
  }
  const hint = findHint(player.hand, landlordState.lastPlay);
  landlordState.selected = hint;
  landlordLog.textContent = hint.length ? `已为 ${player.name} 选中一组可出的牌。` : "没有可出的牌，请选择不出。";
  renderLandlord();
}

function playSelectedCards() {
  if (!landlordState.started || landlordState.over) return;
  const player = landlordState.seats[landlordState.turn];
  if (player.type === "robot") return robotPlay();
  const cards = landlordState.selected.map((index) => player.hand[index]);
  submitPlay(cards);
}

function submitPlay(cards) {
  const player = landlordState.seats[landlordState.turn];
  const play = classify(cards);
  if (!play) {
    landlordLog.textContent = "这个牌型暂不支持。";
    return false;
  }
  if (!beats(play, landlordState.lastPlay)) {
    landlordLog.textContent = "必须出同牌型更大的牌，或出炸弹/王炸。";
    return false;
  }
  const ids = new Set(cards.map((card) => card.id));
  player.hand = player.hand.filter((card) => !ids.has(card.id));
  landlordState.lastPlay = { ...play, cards };
  landlordState.passes = 0;
  landlordState.selected = [];
  landlordLog.textContent = `${player.name} 出了 ${cards.map(cardText).join(" ")}。`;
  if (!player.hand.length) {
    landlordState.over = true;
    landlordLog.textContent = `${player.name} 出完手牌，获胜！`;
  } else {
    nextLandlordTurn();
    maybeRobotTurn();
  }
  renderLandlord();
  return true;
}

function robotPlay() {
  const robot = landlordState.seats[landlordState.turn];
  const hint = findHint(robot.hand, landlordState.lastPlay);
  if (hint.length) submitPlay(hint.map((index) => robot.hand[index]));
  else passCards();
}

function maybeRobotTurn() {
  if (!landlordState.over && landlordState.seats[landlordState.turn].type === "robot") {
    setTimeout(robotPlay, 350);
  }
}

function passCards() {
  if (!landlordState.started || landlordState.over || !landlordState.lastPlay) return;
  landlordState.passes += 1;
  if (landlordState.passes >= 2) {
    landlordState.lastPlay = null;
    landlordState.passes = 0;
    landlordLog.textContent = "一轮结束，可以重新领出。";
  }
  landlordState.selected = [];
  nextLandlordTurn();
  renderLandlord();
  maybeRobotTurn();
}

function nextLandlordTurn() {
  landlordState.turn = (landlordState.turn + 1) % landlordState.seats.length;
}

function cardText(card) {
  if (!card.suit) return "Joker";
  return `${card.rank}${suitLabel(card.suit)}`;
}

function suitLabel(suit) {
  return {
    S: "\u2660",
    H: "\u2665",
    C: "\u2663",
    D: "\u2666",
  }[suit] || suit;
}

function jokerTone(card) {
  return rankValue[card.rank] === ranks.length - 1 ? "red" : "black";
}

function renderLandlord() {
  const full = landlordState.seats.length >= 3;
  addHumanBtn.disabled = landlordState.seats.filter((seat) => seat.type === "human").length >= 2 || full || landlordState.started;
  addRobotBtn.disabled = full || landlordState.started;
  landlordRoomLog.textContent = full ? "座位已满，不能再加机器人。" : "未满时可以启动机器人补位。";
  landlordTurn.textContent = !landlordState.started ? "等待开始" : landlordState.over ? "已结束" : landlordState.seats[landlordState.turn].name;
  lastPlay.innerHTML = "";
  (landlordState.lastPlay?.cards || []).forEach((card) => lastPlay.appendChild(cardButton(card, false)));

  landlordPlayers.innerHTML = "";
  landlordState.seats.forEach((player, playerIndex) => {
    const section = document.createElement("section");
    section.className = "hand-card player-strip";
    section.innerHTML = `<header><h3>${player.name}${player.type === "robot" ? "（机器人）" : ""}</h3><span>${player.hand.length} 张</span></header>`;
    const hand = document.createElement("div");
    hand.className = "card-hand";
    player.hand.forEach((card, cardIndex) => {
      const enabled = landlordState.started && playerIndex === landlordState.turn && player.type === "human" && !landlordState.over;
      const btn = cardButton(card, enabled);
      if (enabled && landlordState.selected.includes(cardIndex)) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        if (!enabled) return;
        landlordState.selected = landlordState.selected.includes(cardIndex)
          ? landlordState.selected.filter((index) => index !== cardIndex)
          : [...landlordState.selected, cardIndex];
        renderLandlord();
      });
      hand.appendChild(btn);
    });
    section.appendChild(hand);
    landlordPlayers.appendChild(section);
  });
}

function cardButton(card, enabled) {
  const btn = document.createElement("button");
  btn.type = "button";
  const color = card.suit ? (card.suit === "H" || card.suit === "D" ? "red" : "black") : jokerTone(card);
  btn.className = `playing-card ${color} ${card.suit ? "" : "joker-card"}`;
  btn.disabled = !enabled;
  const rank = card.suit ? card.rank : "Joker";
  const suit = card.suit ? suitLabel(card.suit) : "\u2605";
  btn.setAttribute("aria-label", cardText(card));
  btn.innerHTML = `
    <span class="card-corner top"><b>${rank}</b><i>${suit}</i></span>
    <span class="card-pip">${suit}</span>
    <span class="card-corner bottom"><b>${rank}</b><i>${suit}</i></span>
  `;
  return btn;
}

window.render_game_to_text = () => JSON.stringify(landlordState);
window.advanceTime = () => renderLandlord();
resetRoom();
