const texasSeats = document.querySelector("#texasSeats");
const communityCards = document.querySelector("#communityCards");
const texasTurn = document.querySelector("#texasTurn");
const texasLog = document.querySelector("#texasLog");
const texasRoomLog = document.querySelector("#texasRoomLog");
const texasRoomBadge = document.querySelector("#texasRoomBadge");
const texasPotBadge = document.querySelector("#texasPotBadge");
const texasPhaseBadge = document.querySelector("#texasPhaseBadge");
const addTexasRobotBtn = document.querySelector("#addTexasRobotBtn");
const startTexasBtn = document.querySelector("#startTexasBtn");
const resetTexasBtn = document.querySelector("#resetTexasBtn");
const checkCallBtn = document.querySelector("#checkCallBtn");
const raiseBtn = document.querySelector("#raiseBtn");
const foldBtn = document.querySelector("#foldBtn");

const suits = ["S", "H", "C", "D"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const rankPower = Object.fromEntries(ranks.map((rank, index) => [rank, index + 2]));
const phaseNames = { idle: "等待开局", preflop: "翻牌前", flop: "翻牌圈", turn: "转牌圈", river: "河牌圈", showdown: "摊牌" };

const texasState = {
  seats: [
    { name: "玩家 A", type: "human", stack: 1000, hand: [], folded: false, bet: 0, acted: false },
    { name: "玩家 B", type: "human", stack: 1000, hand: [], folded: false, bet: 0, acted: false },
  ],
  deck: [],
  community: [],
  pot: 0,
  currentBet: 0,
  dealer: 0,
  turn: 0,
  phase: "idle",
  started: false,
  over: false,
  winners: [],
  message: "创建或加入房间后，由房主开始一局。",
  room: null,
};

let texasRoomApi = null;

texasRoomApi = window.initRoomPanel({
  gameKey: "texas",
  prefix: "TX",
  getSnapshot: () => texasState,
  onRemoteState(snapshot) {
    const localRoom = texasState.room;
    Object.assign(texasState, snapshot);
    texasState.room = localRoom;
    renderTexas();
    maybeRobotTurn();
  },
  onRoomChange(room) {
    texasState.room = room;
    texasRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
    renderTexas();
  },
});

addTexasRobotBtn.addEventListener("click", addRobot);
startTexasBtn.addEventListener("click", startTexas);
resetTexasBtn.addEventListener("click", resetTable);
checkCallBtn.addEventListener("click", callOrCheck);
raiseBtn.addEventListener("click", () => raiseBet(20));
foldBtn.addEventListener("click", foldSeat);

function buildDeck() {
  const deck = [];
  suits.forEach((suit) => ranks.forEach((rank) => deck.push({ rank, suit, id: `${rank}${suit}` })));
  return deck.sort(() => Math.random() - 0.5);
}

function syncTexas() {
  texasRoomApi?.broadcast?.(texasState);
}

function localSeatIndex() {
  return texasRoomApi?.localSeatIndex?.() || 0;
}

function isLocalSeat(index) {
  if (texasState.seats[index]?.type === "robot") return true;
  if (index === localSeatIndex()) return true;
  return texasRoomApi?.isHost?.() && texasRoomApi?.connectionCount?.() === 0 && texasState.seats[index]?.type === "human";
}

function canHostEdit() {
  return !texasRoomApi?.hasRoom?.() || texasRoomApi?.isHost?.();
}

function addRobot() {
  if (!canHostEdit() || texasState.started || texasState.seats.length >= 6) return;
  texasState.seats.push({ name: `机器人 ${texasState.seats.length}`, type: "robot", stack: 1000, hand: [], folded: false, bet: 0, acted: false });
  texasState.message = "已加入机器人。";
  renderTexas();
  syncTexas();
}

function resetTable() {
  if (!canHostEdit()) return;
  texasState.seats = [
    { name: "玩家 A", type: "human", stack: 1000, hand: [], folded: false, bet: 0, acted: false },
    { name: "玩家 B", type: "human", stack: 1000, hand: [], folded: false, bet: 0, acted: false },
  ];
  texasState.deck = [];
  texasState.community = [];
  texasState.pot = 0;
  texasState.currentBet = 0;
  texasState.dealer = 0;
  texasState.turn = 0;
  texasState.phase = "idle";
  texasState.started = false;
  texasState.over = false;
  texasState.winners = [];
  texasState.message = "牌桌已重置。";
  renderTexas();
  syncTexas();
}

function startTexas() {
  const blocked = texasRoomApi?.requireHost?.();
  if (blocked) {
    texasState.message = blocked;
    renderTexas();
    return;
  }
  if (texasState.seats.length < 2) return;
  texasState.deck = buildDeck();
  texasState.community = [];
  texasState.pot = 0;
  texasState.currentBet = 10;
  texasState.dealer = (texasState.dealer + 1) % texasState.seats.length;
  texasState.seats.forEach((seat) => {
    seat.hand = [texasState.deck.pop(), texasState.deck.pop()];
    seat.folded = false;
    seat.bet = Math.min(10, seat.stack);
    seat.stack -= seat.bet;
    seat.acted = false;
    texasState.pot += seat.bet;
  });
  texasState.turn = nextActiveIndex(texasState.dealer);
  texasState.phase = "preflop";
  texasState.started = true;
  texasState.over = false;
  texasState.winners = [];
  texasState.message = "翻牌前下注开始。";
  renderTexas();
  syncTexas();
  maybeRobotTurn();
}

function activeSeats() {
  return texasState.seats.map((seat, index) => ({ seat, index })).filter(({ seat }) => !seat.folded && seat.stack >= 0);
}

function nextActiveIndex(from) {
  for (let step = 1; step <= texasState.seats.length; step += 1) {
    const index = (from + step) % texasState.seats.length;
    if (!texasState.seats[index].folded) return index;
  }
  return from;
}

function currentSeat() {
  return texasState.seats[texasState.turn];
}

function canAct() {
  return texasState.started && !texasState.over && texasState.phase !== "idle" && texasState.phase !== "showdown" && isLocalSeat(texasState.turn);
}

function commitAction(index, label) {
  const seat = texasState.seats[index];
  seat.acted = true;
  texasState.message = `${seat.name} ${label}。`;
  if (activeSeats().length === 1) {
    finishByFold();
    return;
  }
  if (roundComplete()) {
    advanceStreet();
    return;
  }
  texasState.turn = nextActiveIndex(index);
}

function roundComplete() {
  return texasState.seats.filter((seat) => !seat.folded).every((seat) => seat.acted && seat.bet === texasState.currentBet);
}

function resetRoundBets() {
  texasState.currentBet = 0;
  texasState.seats.forEach((seat) => {
    seat.bet = 0;
    seat.acted = seat.folded;
  });
  texasState.turn = nextActiveIndex(texasState.dealer);
}

function advanceStreet() {
  if (texasState.phase === "preflop") {
    texasState.community.push(texasState.deck.pop(), texasState.deck.pop(), texasState.deck.pop());
    texasState.phase = "flop";
    texasState.message = "翻牌圈开始。";
    resetRoundBets();
    return;
  }
  if (texasState.phase === "flop") {
    texasState.community.push(texasState.deck.pop());
    texasState.phase = "turn";
    texasState.message = "转牌圈开始。";
    resetRoundBets();
    return;
  }
  if (texasState.phase === "turn") {
    texasState.community.push(texasState.deck.pop());
    texasState.phase = "river";
    texasState.message = "河牌圈开始。";
    resetRoundBets();
    return;
  }
  showdown();
}

function callOrCheck() {
  if (!canAct()) return;
  const seat = currentSeat();
  const diff = Math.max(0, texasState.currentBet - seat.bet);
  const paid = Math.min(diff, seat.stack);
  seat.stack -= paid;
  seat.bet += paid;
  texasState.pot += paid;
  commitAction(texasState.turn, diff ? `跟注 ${paid}` : "过牌");
  renderTexas();
  syncTexas();
  maybeRobotTurn();
}

function raiseBet(amount) {
  if (!canAct()) return;
  const seat = currentSeat();
  const target = texasState.currentBet + amount;
  const diff = Math.max(0, target - seat.bet);
  const paid = Math.min(diff, seat.stack);
  if (paid <= 0) return;
  seat.stack -= paid;
  seat.bet += paid;
  texasState.pot += paid;
  texasState.currentBet = seat.bet;
  texasState.seats.forEach((other) => {
    if (!other.folded) other.acted = false;
  });
  commitAction(texasState.turn, `加注到 ${seat.bet}`);
  renderTexas();
  syncTexas();
  maybeRobotTurn();
}

function foldSeat() {
  if (!canAct()) return;
  currentSeat().folded = true;
  commitAction(texasState.turn, "弃牌");
  renderTexas();
  syncTexas();
  maybeRobotTurn();
}

function finishByFold() {
  const winner = activeSeats()[0];
  winner.seat.stack += texasState.pot;
  texasState.winners = [winner.index];
  texasState.phase = "showdown";
  texasState.over = true;
  texasState.message = `${winner.seat.name} 赢得底池 ${texasState.pot}。`;
}

function scoreFive(cards) {
  const values = cards.map((card) => rankPower[card.rank]).sort((a, b) => b - a);
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const unique = [...new Set(values)].sort((a, b) => b - a);
  const wheel = unique.join(",") === "14,5,4,3,2";
  const straightHigh = wheel ? 5 : unique.length === 5 && unique[0] - unique[4] === 4 ? unique[0] : 0;
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map((g) => g[0]).sort((a, b) => b - a)];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map((g) => g[0]).sort((a, b) => b - a)];
  return [0, ...values];
}

function combinations(cards, size, start = 0, pick = [], out = []) {
  if (pick.length === size) {
    out.push(pick.map((index) => cards[index]));
    return out;
  }
  for (let i = start; i < cards.length; i += 1) combinations(cards, size, i + 1, [...pick, i], out);
  return out;
}

function compareScore(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function bestScore(cards) {
  return combinations(cards, 5).map(scoreFive).sort(compareScore).at(-1);
}

function showdown() {
  const scored = texasState.seats
    .map((seat, index) => ({ seat, index, score: seat.folded ? [-1] : bestScore([...seat.hand, ...texasState.community]) }))
    .filter(({ seat }) => !seat.folded)
    .sort((a, b) => compareScore(b.score, a.score));
  const best = scored[0]?.score || [0];
  const winners = scored.filter((item) => compareScore(item.score, best) === 0);
  const share = Math.floor(texasState.pot / winners.length);
  winners.forEach(({ seat }) => {
    seat.stack += share;
  });
  texasState.winners = winners.map((item) => item.index);
  texasState.phase = "showdown";
  texasState.over = true;
  texasState.message = `${winners.map((item) => item.seat.name).join("、")} 赢得底池 ${texasState.pot}。`;
}

function maybeRobotTurn() {
  if (!texasRoomApi?.isHost?.() || texasState.over || !texasState.started) return;
  const seat = currentSeat();
  if (!seat || seat.type !== "robot") return;
  setTimeout(() => {
    if (texasState.currentBet > seat.bet && Math.random() < 0.18) foldSeat();
    else if (Math.random() < 0.24 && seat.stack > 20) raiseBet(20);
    else callOrCheck();
  }, 250);
}

function suitLabel(suit) {
  return { S: "♠", H: "♥", C: "♣", D: "♦" }[suit] || suit;
}

function cardText(card) {
  return `${card.rank}${suitLabel(card.suit)}`;
}

function cardNode(card, hidden = false) {
  if (hidden) {
    const back = document.createElement("div");
    back.className = "playing-card card-back";
    back.innerHTML = "<span></span>";
    return back;
  }
  const node = document.createElement("div");
  const color = card.suit === "H" || card.suit === "D" ? "red" : "black";
  const suit = suitLabel(card.suit);
  node.className = `playing-card ${color}`;
  node.innerHTML = `<span class="card-corner top"><b>${card.rank}</b><i>${suit}</i></span><span class="card-pip">${suit}</span><span class="card-corner bottom"><b>${card.rank}</b><i>${suit}</i></span>`;
  node.setAttribute("aria-label", cardText(card));
  return node;
}

function renderTexas() {
  texasRoomBadge.textContent = texasState.room?.roomId ? `房间：${texasState.room.roomId}` : "房间：未进入";
  texasPotBadge.textContent = `底池：${texasState.pot}`;
  texasPhaseBadge.textContent = phaseNames[texasState.phase] || texasState.phase;
  texasTurn.textContent = texasState.over ? "本局结束" : texasState.started ? `${currentSeat()?.name || ""} 操作` : "等待开局";
  texasLog.textContent = texasState.message;
  texasRoomLog.textContent = texasState.seats.length >= 6 ? "座位已满。" : "满 2 个座位即可开始，最多 6 个座位。";
  addTexasRobotBtn.disabled = !canHostEdit() || texasState.started || texasState.seats.length >= 6;
  startTexasBtn.disabled = !texasRoomApi?.isHost?.() || texasState.seats.length < 2;
  resetTexasBtn.disabled = !canHostEdit();
  checkCallBtn.disabled = !canAct();
  raiseBtn.disabled = !canAct();
  foldBtn.disabled = !canAct() || texasState.currentBet === 0;

  communityCards.innerHTML = "";
  texasState.community.forEach((card) => communityCards.appendChild(cardNode(card)));
  for (let i = texasState.community.length; i < 5; i += 1) communityCards.appendChild(cardNode(null, true));

  texasSeats.innerHTML = "";
  texasState.seats.forEach((seat, index) => {
    const section = document.createElement("section");
    section.className = `surface-card poker-seat ${index === texasState.turn && texasState.started && !texasState.over ? "active" : ""} ${texasState.winners.includes(index) ? "winner" : ""}`;
    const self = isLocalSeat(index) || texasState.over || seat.type === "robot";
    section.innerHTML = `<header><h3>${seat.name}${seat.type === "robot" ? "（机器人）" : ""}</h3><span>${seat.folded ? "已弃牌" : `筹码 ${seat.stack}`}</span></header><p class="mini-note">本轮下注：${seat.bet}</p>`;
    const hand = document.createElement("div");
    hand.className = "card-hand";
    seat.hand.forEach((card) => hand.appendChild(cardNode(card, !self)));
    section.appendChild(hand);
    texasSeats.appendChild(section);
  });
}

window.render_game_to_text = () =>
  JSON.stringify({
    ...texasState,
    deck: [],
    seats: texasState.seats.map((seat, index) => ({
      ...seat,
      hand: isLocalSeat(index) || texasState.over ? seat.hand : seat.hand.map(() => ({ hidden: true })),
      handCount: seat.hand.length,
    })),
    room: texasState.room ? { roomId: texasState.room.roomId, role: texasState.room.role } : null,
  });
window.advanceTime = () => renderTexas();

renderTexas();
