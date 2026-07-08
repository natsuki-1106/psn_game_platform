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

  await page.goto(`${baseUrl}/gomoku.html`, { waitUntil: "networkidle" });
  await page.click("#hostBtn");

  const initialState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const controlsAfterJoin = await page.evaluate(() => ({
    hostHidden: document.querySelector("#hostBtn")?.hidden ?? null,
    joinHidden: document.querySelector("#joinBtn")?.hidden ?? null,
    localHidden: document.querySelector("#localBtn")?.hidden ?? null,
    leaveHidden: document.querySelector("#leaveRoomBtn")?.hidden ?? null,
  }));
  await page.reload({ waitUntil: "networkidle" });
  const restoredState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.click("#leaveRoomBtn");
  await page.click("#localBtn");

  const box = await page.locator("#boardCanvas").boundingBox();
  const cellPoint = (row, col) => {
    const pad = 42;
    const gap = (760 - pad * 2) / 14;
    return {
      x: box.x + ((pad + col * gap) * box.width) / 760,
      y: box.y + ((pad + row * gap) * box.height) / 760,
    };
  };

  for (const [row, col] of [
    [7, 7],
    [7, 8],
    [8, 7],
    [8, 8],
    [9, 7],
    [9, 8],
    [10, 7],
    [10, 8],
    [11, 7],
  ]) {
    const point = cellPoint(row, col);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(50);
  }

  await page.locator("#resultModal").waitFor({ state: "visible" });
  const wonState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const status = await page.locator("#matchStatus").innerText();
  const modalText = await page.locator("#resultSummary").innerText();
  await page.screenshot({ path: "outputs/gomoku-modal.png", fullPage: true });

  await page.click("#playAgainBtn");
  await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).modalOpen);
  const replayState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  for (const [row, col] of [
    [6, 6],
    [6, 7],
    [7, 6],
    [7, 7],
    [8, 6],
    [8, 7],
    [9, 6],
    [9, 7],
    [10, 6],
  ]) {
    const point = cellPoint(row, col);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(50);
  }

  await page.locator("#resultModal").waitFor({ state: "visible" });
  const secondWonState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.click("#exitRoomBtn");
  await page.waitForURL(/index\.html$/);
  const lobbyTitle = await page.locator("h1").innerText();

  await page.screenshot({ path: "outputs/gomoku-smoke.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ initialState, restoredState, controlsAfterJoin, status, modalText, wonState, replayState, secondWonState, lobbyTitle, errors }, null, 2));

  if (errors.length) process.exit(1);
  if (!initialState.supabaseConfigured) {
    if (!initialState.message.includes("Supabase")) process.exit(1);
  } else {
    if (!initialState.roomId || initialState.mode !== "online") process.exit(1);
    if (restoredState.roomId !== initialState.roomId || restoredState.mode !== "online") process.exit(1);
  }
  if (!controlsAfterJoin.hostHidden || !controlsAfterJoin.joinHidden || !controlsAfterJoin.localHidden || controlsAfterJoin.leaveHidden) process.exit(1);
  if (wonState.winner !== "黑棋") process.exit(1);
  if (!wonState.modalOpen) process.exit(1);
  if (wonState.record.total !== 1 || wonState.record.black !== 1 || wonState.record.white !== 0) process.exit(1);
  if (replayState.winner !== null || replayState.moves.length !== 0) process.exit(1);
  if (replayState.record.total !== 1 || replayState.record.black !== 1) process.exit(1);
  if (secondWonState.record.total !== 2 || secondWonState.record.black !== 2) process.exit(1);
  if (lobbyTitle !== "LinkPlay") process.exit(1);
})();
