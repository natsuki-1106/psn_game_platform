const { chromium } = require("playwright");
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8080";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`${baseUrl}/gomoku.html`, { waitUntil: "networkidle" });
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

  const textState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const status = await page.locator("#matchStatus").innerText();
  await page.screenshot({ path: "outputs/gomoku-smoke.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ status, textState, errors }, null, 2));

  if (errors.length) process.exit(1);
  if (textState.winner !== "黑棋") process.exit(1);
})();
