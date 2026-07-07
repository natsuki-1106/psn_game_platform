const fs = require("fs");
const { chromium } = require("playwright");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8080";

(async () => {
  fs.mkdirSync("outputs", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`${baseUrl}/monopoly.html`, { waitUntil: "networkidle" });
  await page.click("#hostBtn");
  await page.selectOption("#monopolyPlayerCount", "4");
  await page.click("#startMonopolyBtn");
  const monopolyState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.goto(`${baseUrl}/ludo.html`, { waitUntil: "networkidle" });
  await page.click("#hostBtn");
  await page.selectOption("#ludoPlayerCount", "4");
  await page.click("#startLudoBtn");
  const ludoState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.goto(`${baseUrl}/checkers.html`, { waitUntil: "networkidle" });
  await page.click("#hostBtn");
  await page.selectOption("#checkersPlayerCount", "6");
  await page.click("#startCheckersBtn");
  const checkersState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.goto(`${baseUrl}/landlord.html`, { waitUntil: "networkidle" });
  await page.click("#hostBtn");
  await page.click("#addRobotBtn");
  await page.click("#startLandlordBtn");
  await page.click("#callLandlordBtn");
  await page.click("#passBidBtn");
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.phase === "playing";
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.seats[state.turn]?.type === "human";
  });
  await page.click("#hintCardsBtn");
  const landlordState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const addRobotDisabled = await page.locator("#addRobotBtn").isDisabled();

  await page.screenshot({ path: "outputs/games-smoke.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ monopolyState, ludoState, checkersState, landlordState, addRobotDisabled, errors }, null, 2));

  if (errors.length) process.exit(1);
  if (monopolyState.players.length !== 4 || !monopolyState.started || !monopolyState.room?.roomId) process.exit(1);
  if (ludoState.teams.length !== 4 || !ludoState.started || !ludoState.room?.roomId) process.exit(1);
  if (checkersState.players.length !== 6 || !checkersState.started || !checkersState.room?.roomId) process.exit(1);
  if (landlordState.seats.length !== 3 || !landlordState.started || !landlordState.room?.roomId) process.exit(1);
  if (landlordState.phase !== "playing") process.exit(1);
  if (landlordState.bottomCards.length !== 3) process.exit(1);
  if (!landlordState.seats.some((seat) => seat.isLandlord && seat.handCount >= 17)) process.exit(1);
  if (landlordState.seats.every((seat) => seat.handCount === 18)) process.exit(1);
  if (!landlordState.seats.some((seat) => seat.type === "robot")) process.exit(1);
  if (!landlordState.selected.length) process.exit(1);
  if (!addRobotDisabled) process.exit(1);
})();
