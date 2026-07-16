const blackjackSeats = document.querySelector("#blackjackSeats");
const dealerCards = document.querySelector("#dealerCards");
const dealerScore = document.querySelector("#dealerScore");
const blackjackTurn = document.querySelector("#blackjackTurn");
const blackjackLog = document.querySelector("#blackjackLog");
const blackjackRoomLog = document.querySelector("#blackjackRoomLog");
const blackjackRoomBadge = document.querySelector("#blackjackRoomBadge");
const blackjackPhaseBadge = document.querySelector("#blackjackPhaseBadge");
const addBlackjackRobotBtn = document.querySelector("#addBlackjackRobotBtn");
const startBlackjackBtn = document.querySelector("#startBlackjackBtn");
const resetBlackjackBtn = document.querySelector("#resetBlackjackBtn");
const hitBtn = document.querySelector("#hitBtn");
const standBtn = document.querySelector("#standBtn");

const suits = ["S", "H", "C", "D"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const blackjackState = {
  seats: [
    { name: "玩家 A", type: "human", hand: [], stood: false, busted: false, bet: 10, chips: 1000 },
    { name: "玩家 B", type: "human", hand: [], stood: false, busted: false, bet: 10, chips: 1000 },
  ],
  dealer: { hand: [], hidden: true },
  deck: [],
  phase: "idle",
  started: false,
  over: false,
  turn: 0,
  winners: [],
  message: "创建或加入房间后，由房主开始一局。",
  room: null,
};

let blackjackRoomApi = null;

blackjackRoomApi = window.initRoomPanel({
  gameKey: "blackjack",
  prefix: "BJ",
  getSnapshot: () => blackjackState,
  onRemoteState(snapshot) {
    const localRoom = blackjackState.room;
    Object.assign(blackjackState, snapshot);
    blackjackState.room = localRoom;
    renderBlackjack();
    maybeRobotTurn();
  },
  onRoomChange(room) {
    blackjackState.room = room;
    blackjackRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
    renderBlackjack();
  },
});

addBlackjackRobotBtn.addEventListener("click", addRobot);
startBlackjackBtn.addEventListener("click", startBlackjack);
resetBlackjackBtn.addEventListener("click", resetTable);
hitBtn.addEventListener("click", hit);
standBtn.addEventListener("click", stand);

function buildDeck() {
  const deck = [];
  suits.forEach((suit) => ranks.forEach((rank) => deck.push({ rank, suit, id: `${rank}${suit}` })));
  return deck.sort(() => Math.random() - 0.5);
}

function syncBlackjack() {
  blackjackRoomApi?.broadcast?.(blackjackState);
}

function localSeatIndex() {
  return blackjackRoomApi?.localSeatIndex?.() || 0;
}

function isLocalSeat(index) {
  if (blackjackState.seats[index]?.type === "robot") return true;
  if (index === localSeatIndex()) return true;
  return blackjackRoomApi?.isHost?.() && blackjackRoomApi?.connectionCount?.() === 0 && blackjackState.seats[index]?.type === "human";
}

function canHostEdit() {
  return !blackjackRoomApi?.hasRoom?.() || blackjackRoomApi?.isHost?.();
}

function addRobot() {
  if (!canHostEdit() || blackjackState.started || blackjackState.seats.length >= 4) return;
  blackjackState.seats.push({ name: `机器人 ${blackjackState.seats.length}`, type: "robot", hand: [], stood: false, busted: false, bet: 10, chips: 1000 });
  blackjackState.message = "已加入机器人。";
  renderBlackjack();
  syncBlackjack();
}

function resetTable() {
  if (!canHostEdit()) return;
  blackjackState.seats = [
    { name: "玩家 A", type: "human", hand: [], stood: false, busted: false, bet: 10, chips: 1000 },
    { name: "玩家 B", type: "human", hand: [], stood: false, busted: false, bet: 10, chips: 1000 },
  ];
  blackjackState.dealer = { hand: [], hidden: true };
  blackjackState.deck = [];
  blackjackState.phase = "idle";
  blackjackState.started = false;
  blackjackState.over = false;
  blackjackState.turn = 0;
  blackjackState.winners = [];
  blackjackState.message = "牌桌已重置。";
  renderBlackjack();
  syncBlackjack();
}

function startBlackjack() {
  const blocked = blackjackRoomApi?.requireHost?.();
  if (blocked) {
    blackjackState.message = blocked;
    renderBlackjack();
    return;
  }
  if (blackjackState.seats.length < 1) return;
  blackjackState.deck = buildDeck();
  blackjackState.dealer = { hand: [blackjackState.deck.pop(), blackjackState.deck.pop()], hidden: true };
  blackjackState.seats.forEach((seat) => {
    seat.hand = [blackjackState.deck.pop(), blackjackState.deck.pop()];
    seat.stood = false;
    seat.busted = false;
  });
  blackjackState.phase = "player";
  blackjackState.started = true;
  blackjackState.over = false;
  blackjackState.turn = nextPlayable(0);
  blackjackState.winners = [];
  blackjackState.message = "轮到玩家要牌。";
  renderBlackjack();
  syncBlackjack();
  maybeRobotTurn();
}

function nextPlayable(from) {
  for (let step = 0; step < blackjackState.seats.length; step += 1) {
    const index = (from + step) % blackjackState.seats.length;
    const seat = blackjackState.seats[index];
    if (!seat.stood && !seat.busted) return index;
  }
  return from;
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  hand.forEach((card) => {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["J", "Q", "K"].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function canAct() {
  return blackjackState.started && !blackjackState.over && blackjackState.phase === "player" && isLocalSeat(blackjackState.turn) && !blackjackState.seats[blackjackState.turn].busted;
}

function nextTurn() {
  const next = nextPlayable((blackjackState.turn + 1) % blackjackState.seats.length);
  if (blackjackState.seats.every((seat) => seat.stood || seat.busted)) {
    settle();
    return;
  }
  blackjackState.turn = next;
  blackjackState.message = `${blackjackState.seats[next].name} 操作。`;
}

function hit() {
  if (!canAct()) return;
  const seat = blackjackState.seats[blackjackState.turn];
  seat.hand.push(blackjackState.deck.pop());
  if (handValue(seat.hand) > 21) {
    seat.busted = true;
    blackjackState.message = `${seat.name} 爆牌。`;
    seat.stood = true;
  } else {
    blackjackState.message = `${seat.name} 要牌。`;
  }
  if (blackjackState.seats.every((s) => s.stood || s.busted)) settle();
  else nextTurn();
  renderBlackjack();
  syncBlackjack();
  maybeRobotTurn();
}

function stand() {
  if (!canAct()) return;
  blackjackState.seats[blackjackState.turn].stood = true;
  blackjackState.message = `${blackjackState.seats[blackjackState.turn].name} 停牌。`;
  if (blackjackState.seats.every((s) => s.stood || s.busted)) settle();
  else nextTurn();
  renderBlackjack();
  syncBlackjack();
  maybeRobotTurn();
}

function settle() {
  blackjackState.phase = "dealer";
  blackjackState.dealer.hidden = false;
  while (handValue(blackjackState.dealer.hand) < 17) blackjackState.dealer.hand.push(blackjackState.deck.pop());
  const dealerScoreValue = handValue(blackjackState.dealer.hand);
  const players = blackjackState.seats.map((seat, index) => ({
    seat,
    index,
    score: seat.busted ? 0 : handValue(seat.hand),
  }));
  const winners = players.filter(({ score }) => score <= 21 && (dealerScoreValue > 21 || score > dealerScoreValue));
  winners.forEach(({ seat }) => {
    seat.chips += seat.bet * 2;
  });
  blackjackState.winners = winners.map((item) => item.index);
  blackjackState.over = true;
  blackjackState.phase = "showdown";
  blackjackState.message = winners.length ? `${winners.map((item) => item.seat.name).join("、")} 赢了。` : "庄家赢了。";
}

function maybeRobotTurn() {
  if (blackjackState.phase !== "player" || blackjackState.over) return;
  const seat = blackjackState.seats[blackjackState.turn];
  if (!seat || seat.type !== "robot") return;
  setTimeout(() => {
    if (handValue(seat.hand) < 16) hit();
    else stand();
  }, 240);
}

function suitLabel(suit) {
  return { S: "♠", H: "♥", C: "♣", D: "♦" }[suit] || suit;
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
  return node;
}

function renderBlackjack() {
  blackjackRoomBadge.textContent = blackjackState.room?.roomId ? `房间：${blackjackState.room.roomId}` : "房间：未进入";
  blackjackPhaseBadge.textContent = blackjackState.phase === "idle" ? "等待开局" : blackjackState.phase === "showdown" ? "结算" : blackjackState.phase;
  blackjackTurn.textContent = blackjackState.over ? "本局结束" : blackjackState.started ? `${blackjackState.seats[blackjackState.turn]?.name || ""} 操作` : "等待开局";
  blackjackLog.textContent = blackjackState.message;
  blackjackRoomLog.textContent = blackjackState.seats.length >= 4 ? "座位已满。" : "最多 3 名玩家同时对庄家。";
  addBlackjackRobotBtn.disabled = !canHostEdit() || blackjackState.started || blackjackState.seats.length >= 4;
  startBlackjackBtn.disabled = !blackjackRoomApi?.isHost?.() || blackjackState.seats.length < 1;
  resetBlackjackBtn.disabled = !canHostEdit();
  hitBtn.disabled = !canAct();
  standBtn.disabled = !canAct();

  dealerCards.innerHTML = "";
  blackjackState.dealer.hand.forEach((card, index) => dealerCards.appendChild(cardNode(card, blackjackState.dealer.hidden && index > 0)));
  dealerScore.textContent = `点数：${blackjackState.dealer.hidden ? "?" : handValue(blackjackState.dealer.hand)}`;

  blackjackSeats.innerHTML = "";
  blackjackState.seats.forEach((seat, index) => {
    const section = document.createElement("section");
    section.className = `surface-card poker-seat ${index === blackjackState.turn && blackjackState.started && !blackjackState.over ? "active" : ""} ${blackjackState.winners.includes(index) ? "winner" : ""}`;
    section.innerHTML = `<header><h3>${seat.name}${seat.type === "robot" ? "（机器人）" : ""}</h3><span>${seat.busted ? "爆牌" : seat.stood ? "停牌" : `筹码 ${seat.chips}`}</span></header><p class="mini-note">点数：${handValue(seat.hand)}</p>`;
    const hand = document.createElement("div");
    hand.className = "card-hand";
    seat.hand.forEach((card) => hand.appendChild(cardNode(card, !isLocalSeat(index) && !blackjackState.over && seat.type !== "robot")));
    section.appendChild(hand);
    blackjackSeats.appendChild(section);
  });
}

window.render_game_to_text = () =>
  JSON.stringify({
    ...blackjackState,
    seats: blackjackState.seats.map((seat, index) => ({
      ...seat,
      handCount: seat.hand.length,
      hand: isLocalSeat(index) || blackjackState.over || seat.type === "robot" ? seat.hand : seat.hand.map(() => ({ hidden: true })),
    })),
    dealer: {
      hand: blackjackState.dealer.hidden && !blackjackState.over ? [blackjackState.dealer.hand[0], { hidden: true }] : blackjackState.dealer.hand,
      hidden: blackjackState.dealer.hidden && !blackjackState.over,
    },
    room: blackjackState.room ? { roomId: blackjackState.room.roomId, role: blackjackState.room.role } : null,
  });
window.advanceTime = () => renderBlackjack();

renderBlackjack();
