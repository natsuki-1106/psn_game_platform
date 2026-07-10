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

  const playCell = async (row, col, rows, cols) => {
    const box = await page.locator("#boardCanvas").boundingBox();
    const pad = 46;
    const usable = 760 - pad * 2;
    const cell = Math.min(usable / cols, usable / rows);
    const width = cell * cols;
    const height = cell * rows;
    const left = (760 - width) / 2;
    const top = (760 - height) / 2;
    await page.mouse.click(
      box.x + ((left + col * cell + cell / 2) * box.width) / 760,
      box.y + ((top + row * cell + cell / 2) * box.height) / 760,
    );
    await page.waitForTimeout(60);
  };

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const lobbyLinks = await page.$$eval(".lobby-game.available", (links) => links.map((link) => link.getAttribute("href")));

  await page.goto(`${baseUrl}/tictactoe.html`, { waitUntil: "networkidle" });
  await page.click("#localBtn");
  for (const [row, col] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0, 2],
  ]) {
    await playCell(row, col, 3, 3);
  }
  const tictactoeState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.goto(`${baseUrl}/reversi.html`, { waitUntil: "networkidle" });
  await page.click("#localBtn");
  await playCell(2, 3, 8, 8);
  const reversiState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.goto(`${baseUrl}/connect4.html`, { waitUntil: "networkidle" });
  await page.click("#localBtn");
  for (const col of [0, 1, 0, 1, 0, 1, 0]) {
    await playCell(0, col, 6, 7);
  }
  const connect4State = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.screenshot({ path: "outputs/grid-games-smoke.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ lobbyLinks, tictactoeState, reversiState, connect4State, errors }, null, 2));

  if (errors.length) process.exit(1);
  if (lobbyLinks[0] !== "gomoku.html" || lobbyLinks[1] !== "tictactoe.html" || lobbyLinks[2] !== "reversi.html" || lobbyLinks[3] !== "connect4.html") process.exit(1);
  if (tictactoeState.game !== "tictactoe" || tictactoeState.winner !== "先手" || tictactoeState.record.black !== 1) process.exit(1);
  if (reversiState.game !== "reversi" || reversiState.moves.length !== 1 || reversiState.board[3][3] !== 1) process.exit(1);
  if (connect4State.game !== "connect4" || connect4State.winner !== "红方" || connect4State.record.black !== 1) process.exit(1);
})();
