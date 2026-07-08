const ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "小王", "大王"];
const rankValue = Object.fromEntries(ranks.map((rank, index) => [rank, index]));
const suits = ["S", "H", "C", "D"];

const landlordState = {
  seats: [
    { name: "玩家 A", type: "human", hand: [] },
    { name: "玩家 B", type: "human", hand: [] },
  ],
  room: null,
  bottomCards: [],
  selected: [],
  lastPlay: null,
  lastPlayerIndex: null,
  passes: 0,
  turn: 0,
  started: false,
  over: false,
  phase: "idle",
  multiplier: 1,
  biddingTurn: 0,
  landlordIndex: null,
  highestBidder: null,
  bidHistory: [],
};

const landlordTurn = document.querySelector("#landlordTurn");
const landlordPhase = document.querySelector("#landlordPhase");
const landlordPlayers = document.querySelector("#landlordPlayers");
const landlordLog = document.querySelector("#landlordLog");
const landlordRoomLog = document.querySelector("#landlordRoomLog");
const landlordRoomBadge = document.querySelector("#landlordRoomBadge");
const landlordMultiplier = document.querySelector("#landlordMultiplier");
const landlordBottom = document.querySelector("#landlordBottom");
const lastPlay = document.querySelector("#lastPlay");
const lastPlayTitle = document.querySelector("#lastPlayTitle");
const addHumanBtn = document.querySelector("#addHumanBtn");
const addRobotBtn = document.querySelector("#addRobotBtn");
const callLandlordBtn = document.querySelector("#callLandlordBtn");
const passBidBtn = document.querySelector("#passBidBtn");
const hintCardsBtn = document.querySelector("#hintCardsBtn");
const playCardsBtn = document.querySelector("#playCardsBtn");
const passCardsBtn = document.querySelector("#passCardsBtn");
const bidActions = document.querySelector("#bidActions");
const playActions = document.querySelector("#playActions");

document.querySelector("#resetLandlordBtn").addEventListener("click", resetRoom);
document.querySelector("#startLandlordBtn").addEventListener("click", startLandlord);
playCardsBtn.addEventListener("click", playSelectedCards);
passCardsBtn.addEventListener("click", passCards);
addHumanBtn.addEventListener("click", addHuman);
addRobotBtn.addEventListener("click", addRobot);
callLandlordBtn.addEventListener("click", () => bidLandlord(true));
passBidBtn.addEventListener("click", () => bidLandlord(false));
hintCardsBtn.addEventListener("click", hintCards);

let landlordRoomApi = null;

landlordRoomApi = window.initRoomPanel({
  gameKey: "landlord",
  prefix: "DD",
  getSnapshot: () => landlordState,
  onRemoteState(snapshot) {
    landlordState.seats = snapshot.seats || landlordState.seats;
    landlordState.bottomCards = snapshot.bottomCards || [];
    landlordState.selected = [];
    landlordState.lastPlay = snapshot.lastPlay || null;
    landlordState.lastPlayerIndex = snapshot.lastPlayerIndex ?? null;
    landlordState.passes = snapshot.passes || 0;
    landlordState.turn = snapshot.turn || 0;
    landlordState.started = Boolean(snapshot.started);
    landlordState.over = Boolean(snapshot.over);
    landlordState.phase = snapshot.phase || "idle";
    landlordState.multiplier = snapshot.multiplier || 1;
    landlordState.biddingTurn = snapshot.biddingTurn || 0;
    landlordState.landlordIndex = snapshot.landlordIndex ?? null;
    landlordState.highestBidder = snapshot.highestBidder ?? null;
    landlordState.bidHistory = snapshot.bidHistory || [];
    renderLandlord();
  },
  onRoomChange(room) {
    landlordState.room = room;
    landlordRoomBadge.textContent = room.roomId ? `房间：${room.roomId}` : "房间：未进入";
    renderLandlord();
  },
});

function localSeatIndex() {
  return landlordRoomApi?.localSeatIndex?.() || 0;
}

function isLocalSeat(index) {
  if (index === localSeatIndex()) return true;
  return landlordRoomApi?.isHost?.() && landlordRoomApi?.connectionCount?.() === 0 && landlordState.seats[index]?.type === "human";
}

function syncLandlord() {
  landlordRoomApi.broadcast(landlordState);
}

function addHuman() {
  if (landlordRoomApi.hasRoom() && !landlordRoomApi.isHost()) return;
  const humanCount = landlordState.seats.filter((seat) => seat.type === "human").length;
  if (humanCount >= 2 || landlordState.seats.length >= 3 || landlordState.started) return;
  landlordState.seats.push({ name: `玩家 ${String.fromCharCode(65 + humanCount)}`, type: "human", hand: [] });
  renderLandlord();
  syncLandlord();
}

function addRobot() {
  if (landlordRoomApi.hasRoom() && !landlordRoomApi.isHost()) return;
  if (landlordState.seats.length >= 3 || landlordState.started) return;
  landlordState.seats.push({ name: "机器人", type: "robot", hand: [] });
  renderLandlord();
  syncLandlord();
}

function resetRoom() {
  if (landlordRoomApi.hasRoom() && !landlordRoomApi.isHost()) return;
  landlordState.seats = [
    { name: "玩家 A", type: "human", hand: [] },
    { name: "玩家 B", type: "human", hand: [] },
  ];
  landlordState.bottomCards = [];
  landlordState.selected = [];
  landlordState.lastPlay = null;
  landlordState.lastPlayerIndex = null;
  landlordState.passes = 0;
  landlordState.turn = 0;
  landlordState.started = false;
  landlordState.over = false;
  landlordState.phase = "idle";
  landlordState.multiplier = 1;
  landlordState.biddingTurn = 0;
  landlordState.landlordIndex = null;
  landlordState.highestBidder = null;
  landlordState.bidHistory = [];
  landlordLog.textContent = "两名真人已就位，可添加机器人补位后开始。";
  renderLandlord();
  syncLandlord();
}

function buildDeck() {
  const deck = [];
  suits.forEach((suit) => ranks.slice(0, 13).forEach((rank) => deck.push({ rank, suit, id: `${rank}${suit}` })));
  deck.push({ rank: "小王", suit: "", id: "joker-small" }, { rank: "大王", suit: "", id: "joker-big" });
  return deck.sort(() => Math.random() - 0.5);
}

function sortHand(hand) {
  hand.sort((a, b) => rankValue[a.rank] - rankValue[b.rank]);
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
    seat.isLandlord = false;
  });

  landlordState.bottomCards = deck.slice(-3);
  deck.slice(0, 51).forEach((card, index) => {
    landlordState.seats[index % 3].hand.push(card);
  });
  landlordState.seats.forEach((seat) => sortHand(seat.hand));

  landlordState.selected = [];
  landlordState.lastPlay = null;
  landlordState.lastPlayerIndex = null;
  landlordState.passes = 0;
  landlordState.turn = 0;
  landlordState.started = true;
  landlordState.over = false;
  landlordState.phase = "bidding";
  landlordState.multiplier = 1;
  landlordState.biddingTurn = 0;
  landlordState.landlordIndex = null;
  landlordState.highestBidder = null;
  landlordState.bidHistory = [];
  landlordLog.textContent = `${landlordState.seats[0].name} 先叫地主。`;
  renderLandlord();
  syncLandlord();
  maybeRobotBid();
}

function bidLandlord(call) {
  if (!landlordState.started || landlordState.phase !== "bidding" || landlordState.over) return;
  if (!isLocalSeat(landlordState.biddingTurn)) return;
  if (landlordState.seats[landlordState.biddingTurn]?.type === "robot") return;
  resolveBid(call);
}

function resolveBid(call) {
  const seat = landlordState.seats[landlordState.biddingTurn];
  landlordState.bidHistory.push({ index: landlordState.biddingTurn, call });

  if (call) {
    landlordState.highestBidder = landlordState.biddingTurn;
    landlordState.multiplier *= 2;
    landlordLog.textContent = `${seat.name}${landlordState.bidHistory.filter((item) => item.call).length > 1 ? " 抢" : " 叫"}地主，倍率 x${landlordState.multiplier}。`;
  } else {
    landlordLog.textContent = `${seat.name} 不叫。`;
  }

  if (landlordState.bidHistory.length >= landlordState.seats.length) {
    finalizeLandlord(landlordState.highestBidder ?? 0);
    return;
  }

  landlordState.biddingTurn = (landlordState.biddingTurn + 1) % landlordState.seats.length;
  renderLandlord();
  syncLandlord();
  maybeRobotBid();
}

function finalizeLandlord(index) {
  landlordState.landlordIndex = index;
  landlordState.seats.forEach((seat, seatIndex) => {
    seat.isLandlord = seatIndex === index;
  });
  landlordState.seats[index].hand.push(...landlordState.bottomCards);
  sortHand(landlordState.seats[index].hand);
  landlordState.phase = "playing";
  landlordState.turn = index;
  landlordLog.textContent = `${landlordState.seats[index].name} 成为地主，获得 3 张底牌。`;
  renderLandlord();
  syncLandlord();
  maybeRobotTurn();
}

function maybeRobotBid() {
  if (landlordState.phase !== "bidding") return;
  const seat = landlordState.seats[landlordState.biddingTurn];
  if (seat.type !== "robot") return;
  setTimeout(() => {
    const hasHighCards = seat.hand.some((card) => rankValue[card.rank] >= rankValue.A) || seat.hand.some((card) => !card.suit);
    resolveBid(hasHighCards || landlordState.highestBidder === null);
  }, 350);
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

function addCandidate(candidates, hand, indices) {
  const play = classify(indices.map((index) => hand[index]));
  if (play) candidates.push({ play, indices });
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
    .map((rank) => ({ index: byRank.get(rank)[0], value: rankValue[rank] }));

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

function findHint(hand, lastPlayInfo) {
  const all = buildHintCandidates(hand).filter((candidate) => beats(candidate.play, lastPlayInfo));
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

function hintCards() {
  if (!landlordState.started || landlordState.phase !== "playing" || landlordState.over) return;
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
  if (!landlordState.started || landlordState.phase !== "playing" || landlordState.over) return;
  const player = landlordState.seats[landlordState.turn];
  if (!isLocalSeat(landlordState.turn) && player.type !== "robot") return;
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
    landlordLog.textContent = "必须出更大的同类型牌，或者炸弹/王炸。";
    return false;
  }

  if (play.type === "bomb" || play.type === "rocket") landlordState.multiplier *= 2;
  const ids = new Set(cards.map((card) => card.id));
  player.hand = player.hand.filter((card) => !ids.has(card.id));
  landlordState.lastPlay = { ...play, cards };
  landlordState.lastPlayerIndex = landlordState.turn;
  landlordState.passes = 0;
  landlordState.selected = [];
  landlordLog.textContent = `${player.name} 出了 ${cards.map(cardText).join(" ")}。`;

  if (!player.hand.length) {
    landlordState.over = true;
    landlordLog.textContent = `${player.name}${player.isLandlord ? "（地主）" : "（农民）"}获胜，倍率 x${landlordState.multiplier}。`;
  } else {
    nextLandlordTurn();
    maybeRobotTurn();
  }

  renderLandlord();
  syncLandlord();
  return true;
}

function robotPlay() {
  const robot = landlordState.seats[landlordState.turn];
  const hint = findHint(robot.hand, landlordState.lastPlay);
  if (hint.length) submitPlay(hint.map((index) => robot.hand[index]));
  else passCards();
}

function maybeRobotTurn() {
  if (landlordState.phase !== "playing" || landlordState.over) return;
  if (landlordState.seats[landlordState.turn].type === "robot") setTimeout(robotPlay, 350);
}

function passCards() {
  if (!landlordState.started || landlordState.phase !== "playing" || landlordState.over || !landlordState.lastPlay) return;
  if (!isLocalSeat(landlordState.turn) && landlordState.seats[landlordState.turn]?.type !== "robot") return;
  landlordState.passes += 1;
  landlordState.selected = [];

  if (landlordState.passes >= 2) {
    landlordState.lastPlay = null;
    landlordState.lastPlayerIndex = null;
    landlordState.passes = 0;
    landlordLog.textContent = "一轮结束，可以重新领出。";
  }

  nextLandlordTurn();
  renderLandlord();
  syncLandlord();
  maybeRobotTurn();
}

function nextLandlordTurn() {
  landlordState.turn = (landlordState.turn + 1) % landlordState.seats.length;
}

function suitLabel(suit) {
  return {
    S: "♠",
    H: "♥",
    C: "♣",
    D: "♦",
  }[suit] || suit;
}

function cardText(card) {
  if (!card.suit) return "Joker";
  return `${card.rank}${suitLabel(card.suit)}`;
}

function jokerTone(card) {
  return card.rank === "大王" ? "red" : "black";
}

function cardButton(card, enabled) {
  const btn = document.createElement("button");
  btn.type = "button";
  const color = card.suit ? (card.suit === "H" || card.suit === "D" ? "red" : "black") : jokerTone(card);
  btn.className = `playing-card ${color} ${card.suit ? "" : "joker-card"}`;
  btn.disabled = !enabled;
  const rank = card.suit ? card.rank : "Joker";
  const suit = card.suit ? suitLabel(card.suit) : "Joker";
  btn.setAttribute("aria-label", cardText(card));
  btn.innerHTML = `
    <span class="card-corner top"><b>${rank}</b><i>${suit}</i></span>
    <span class="card-pip">${suit}</span>
    <span class="card-corner bottom"><b>${rank}</b><i>${suit}</i></span>
  `;
  return btn;
}

function cardBack(extraClass = "") {
  const card = document.createElement("div");
  card.className = `playing-card card-back ${extraClass}`.trim();
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = "<span></span>";
  return card;
}

function renderLandlord() {
  const full = landlordState.seats.length >= 3;
  const localIndex = localSeatIndex();
  const bidSeat = landlordState.seats[landlordState.biddingTurn];
  const activeSeat = landlordState.seats[landlordState.turn];

  addHumanBtn.disabled = !landlordRoomApi?.isHost?.() || landlordState.seats.filter((seat) => seat.type === "human").length >= 2 || full || landlordState.started;
  addRobotBtn.disabled = !landlordRoomApi?.isHost?.() || full || landlordState.started;
  callLandlordBtn.disabled = landlordState.phase !== "bidding" || !isLocalSeat(landlordState.biddingTurn) || bidSeat?.type !== "human";
  passBidBtn.disabled = landlordState.phase !== "bidding" || !isLocalSeat(landlordState.biddingTurn) || bidSeat?.type !== "human";
  hintCardsBtn.disabled = landlordState.phase !== "playing" || !isLocalSeat(landlordState.turn) || activeSeat?.type !== "human";
  playCardsBtn.disabled = landlordState.phase !== "playing" || !isLocalSeat(landlordState.turn) || activeSeat?.type !== "human";
  passCardsBtn.disabled = landlordState.phase !== "playing" || !isLocalSeat(landlordState.turn) || !landlordState.lastPlay || activeSeat?.type !== "human";

  bidActions.hidden = landlordState.phase !== "bidding";
  playActions.hidden = landlordState.phase !== "playing";

  landlordRoomLog.textContent = full ? "座位已满，不能再加机器人。" : "未满时可以加入机器人补位。";
  landlordPhase.textContent =
    landlordState.phase === "idle"
      ? "等待发牌"
      : landlordState.phase === "bidding"
        ? `${bidSeat?.name || "玩家"} 叫地主`
        : landlordState.landlordIndex === null
          ? "等待确认地主"
          : `${landlordState.seats[landlordState.landlordIndex].name} 是地主`;
  landlordTurn.textContent =
    !landlordState.started ? "等待开始" : landlordState.over ? "已结束" : landlordState.phase === "bidding" ? bidSeat?.name || "" : activeSeat?.name || "";
  landlordMultiplier.textContent = `倍率：x${landlordState.multiplier}`;

  landlordBottom.innerHTML = "";
  landlordState.bottomCards.forEach((card) => {
    const revealed = landlordState.phase === "playing" || landlordState.over;
    landlordBottom.appendChild(revealed ? cardButton(card, false) : cardBack());
  });

  lastPlay.innerHTML = "";
  const lastOwner = landlordState.lastPlayerIndex == null ? null : landlordState.seats[landlordState.lastPlayerIndex];
  lastPlayTitle.textContent = landlordState.lastPlay ? `${lastOwner?.name || "上一手"} 出牌` : "桌面";
  (landlordState.lastPlay?.cards || []).forEach((card) => lastPlay.appendChild(cardButton(card, false)));

  landlordPlayers.innerHTML = "";
  landlordState.seats.forEach((player, playerIndex) => {
    const section = document.createElement("section");
    const isSelf = playerIndex === localIndex;
    section.className = `hand-card player-strip landlord-seat ${isSelf ? "self" : "opponent"} seat-${playerIndex}`;
    section.innerHTML = `
      <header>
        <h3>${player.name}${player.isLandlord ? "（地主）" : player.type === "robot" ? "（机器人）" : ""}</h3>
        <span>${player.hand.length} 张</span>
      </header>
    `;

    const played = document.createElement("div");
    played.className = "card-hand seat-played";
    if (landlordState.lastPlay && landlordState.lastPlayerIndex === playerIndex) {
      landlordState.lastPlay.cards.forEach((card) => played.appendChild(cardButton(card, false)));
    }
    section.appendChild(played);

    const hand = document.createElement("div");
    hand.className = "card-hand";
    const visible = player.type === "human" && (isSelf || landlordState.phase === "idle");

    player.hand.forEach((card, cardIndex) => {
      const enabled = landlordState.phase === "playing" && playerIndex === landlordState.turn && isSelf && player.type === "human" && !landlordState.over;
      const node = visible ? cardButton(card, enabled) : cardBack("side");
      if (visible && enabled && landlordState.selected.includes(cardIndex)) node.classList.add("selected");
      if (visible) {
        node.addEventListener("click", () => {
          if (!enabled) return;
          landlordState.selected = landlordState.selected.includes(cardIndex)
            ? landlordState.selected.filter((index) => index !== cardIndex)
            : [...landlordState.selected, cardIndex];
          renderLandlord();
        });
      }
      hand.appendChild(node);
    });

    section.appendChild(hand);
    landlordPlayers.appendChild(section);
  });
}

window.render_game_to_text = () =>
  JSON.stringify({
    ...landlordState,
    seats: landlordState.seats.map((seat, index) => ({
      ...seat,
      handCount: seat.hand.length,
      hand: index === localSeatIndex() ? seat.hand : seat.hand.map(() => ({ hidden: true })),
    })),
  });

window.advanceTime = () => renderLandlord();
resetRoom();
