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

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const lobbyTitle = await page.locator("h1").innerText();
  await page.click('a[href="gomoku.html"]');
  await page.waitForURL(/gomoku\.html$/);
  const gameTitle = await page.locator(".stage-header h2").innerText();
  await page.screenshot({ path: "outputs/lobby-to-gomoku.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ lobbyTitle, gameTitle, errors }, null, 2));

  if (errors.length) process.exit(1);
  if (lobbyTitle !== "LinkPlay") process.exit(1);
  if (gameTitle !== "五子棋") process.exit(1);
})();
