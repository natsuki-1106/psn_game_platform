const ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "小王", "大王"];
const rankValue = Object.fromEntries(ranks.map((rank, index) => [rank, index]));
const suits = ["♠", "♥", "♣", "♦"];
const landlordState = {
  players: [
    { name: "玩家 A", hand: [] },
    { name: "玩家 B", hand: [] },
    { name: "玩家 C", hand: [] },
  ],
  turn: 0,
  selected: [],
  lastPlay: null,
  passes: 0,
  over: false,
};

const landlordTurn = document.querySelector("#landlordTurn");
const landlordPlayers = document.querySelector("#landlordPlayers");
const landlordLog = document.querySelector("#landlordLog");
const lastPlay = document.querySelector("#lastPlay");
document.querySelector("#playCardsBtn").addEventListener("click", playSelectedCards);
document.querySelector("#passCardsBtn").addEventListener("click", passCards);
document.querySelector("#resetLandlordBtn").addEventListener("click", dealLandlord);

function buildDeck() {
  const deck = [];
  suits.forEach((suit) => ranks.slice(0, 13).forEach((rank) => deck.push({ rank, suit, id: `${rank}${suit}` })));
  deck.push({ rank: "小王", suit: "", id: "小王" }, { rank: "大王", suit: "", id: "大王" });
  return deck.sort(() => Math.random() - 0.5);
}

function dealLandlord() {
  const deck = buildDeck();
  landlordState.players.forEach((player) => {
    player.hand = [];
  });
  deck.forEach((card, index) => landlordState.players[index % 3].hand.push(card));
  landlordState.players.forEach((player) => sortHand(player.hand));
  landlordState.turn = 0;
  landlordState.selected = [];
  landlordState.lastPlay = null;
  landlordState.passes = 0;
  landlordState.over = false;
  landlordLog.textContent = "玩家 A 先出牌。";
  renderLandlord();
}

function sortHand(hand) {
  hand.sort((a, b) => rankValue[a.rank] - rankValue[b.rank]);
}

function classify(cards) {
  const values = cards.map((card) => rankValue[card.rank]).sort((a, b) => a - b);
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.values()].sort((a, b) => b - a);

  if (cards.length === 1) return { type: "single", power: values[0] };
  if (cards.length === 2 && values.includes(rankValue["小王"]) && values.includes(rankValue["大王"])) return { type: "rocket", power: 99 };
  if (cards.length === 2 && groups[0] === 2) return { type: "pair", power: values[0] };
  if (cards.length === 3 && groups[0] === 3) return { type: "triple", power: values[0] };
  if (cards.length === 4 && groups[0] === 4) return { type: "bomb", power: values[0] };
  if (cards.length >= 5 && groups.every((count) => count === 1) && values.every((value) => value < rankValue["2"])) {
    const straight = values.every((value, index) => index === 0 || value === values[index - 1] + 1);
    if (straight) return { type: "straight", power: values.at(-1) };
  }
  return null;
}

function beats(play, last) {
  if (!last) return true;
  if (play.type === "rocket") return true;
  if (play.type === "bomb" && last.type !== "bomb" && last.type !== "rocket") return true;
  return play.type === last.type && play.count === last.count && play.power > last.power;
}

function playSelectedCards() {
  if (landlordState.over) return;
  const player = landlordState.players[landlordState.turn];
  const cards = landlordState.selected.map((index) => player.hand[index]);
  const play = classify(cards);
  if (!play) {
    landlordLog.textContent = "这个牌型暂不支持。";
    return;
  }
  play.count = cards.length;
  if (!beats(play, landlordState.lastPlay)) {
    landlordLog.textContent = "必须出同牌型更大的牌，或出炸弹/王炸。";
    return;
  }
  landlordState.selected
    .slice()
    .sort((a, b) => b - a)
    .forEach((index) => player.hand.splice(index, 1));
  landlordState.lastPlay = { ...play, cards };
  landlordState.passes = 0;
  landlordLog.textContent = `${player.name} 出了 ${cards.map(cardText).join(" ")}。`;
  if (!player.hand.length) {
    landlordState.over = true;
    landlordLog.textContent = `${player.name} 出完手牌，获胜！`;
  } else {
    nextLandlordTurn();
  }
  landlordState.selected = [];
  renderLandlord();
}

function passCards() {
  if (landlordState.over || !landlordState.lastPlay) return;
  landlordState.passes += 1;
  if (landlordState.passes >= 2) {
    landlordState.lastPlay = null;
    landlordState.passes = 0;
    landlordLog.textContent = "一轮结束，可以重新领出。";
  }
  nextLandlordTurn();
  landlordState.selected = [];
  renderLandlord();
}

function nextLandlordTurn() {
  landlordState.turn = (landlordState.turn + 1) % 3;
}

function cardText(card) {
  return `${card.rank}${card.suit}`;
}

function renderLandlord() {
  landlordTurn.textContent = landlordState.over ? "已结束" : landlordState.players[landlordState.turn].name;
  lastPlay.innerHTML = "";
  (landlordState.lastPlay?.cards || []).forEach((card) => lastPlay.appendChild(cardButton(card, false)));

  landlordPlayers.innerHTML = "";
  landlordState.players.forEach((player, playerIndex) => {
    const section = document.createElement("section");
    section.className = "hand-card player-strip";
    section.innerHTML = `<header><h3>${player.name}</h3><span>${player.hand.length} 张</span></header>`;
    const hand = document.createElement("div");
    hand.className = "card-hand";
    player.hand.forEach((card, cardIndex) => {
      const btn = cardButton(card, playerIndex === landlordState.turn && !landlordState.over);
      if (playerIndex === landlordState.turn && landlordState.selected.includes(cardIndex)) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        if (playerIndex !== landlordState.turn || landlordState.over) return;
        if (landlordState.selected.includes(cardIndex)) {
          landlordState.selected = landlordState.selected.filter((index) => index !== cardIndex);
        } else {
          landlordState.selected.push(cardIndex);
        }
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
  btn.className = `playing-card ${card.suit === "♥" || card.suit === "♦" ? "red" : "black"}`;
  btn.disabled = !enabled;
  btn.textContent = cardText(card);
  return btn;
}

window.render_game_to_text = () => JSON.stringify(landlordState);
window.advanceTime = () => renderLandlord();
dealLandlord();
