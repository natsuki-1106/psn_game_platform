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

  const routes = [
    { href: "monopoly.html", title: "大富翁" },
    { href: "ludo.html", title: "飞行棋" },
    { href: "checkers.html", title: "跳棋" },
    { href: "landlord.html", title: "斗地主" },
  ];

  const seen = [];
  for (const route of routes) {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.click(`a[href="${route.href}"]`);
    await page.waitForURL(new RegExp(route.href.replace(".", "\\.")));
    const title = await page.locator(".brand h1").innerText();
    seen.push({ href: route.href, title });
  }

  await page.screenshot({ path: "outputs/games-smoke.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ seen, errors }, null, 2));

  if (errors.length) process.exit(1);
  if (seen.some((item, index) => item.title !== routes[index].title)) process.exit(1);
})();
