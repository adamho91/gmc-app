import { chromium } from "playwright";

const url = "http://127.0.0.1:8765/page.html";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

const frame = page.frameLocator("iframe").first();
await frame.locator("#canvas-wrap").waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);

const iframeInfo = await frame.locator("body").evaluate(() => {
  const wrap = document.getElementById("canvas-wrap");
  const vas = document.getElementById("vas-c");
  const canvas = document.querySelector("#text-layer canvas.p5Canvas");
  return {
    hasWrap: !!wrap,
    embedClass: document.documentElement.classList.contains("gmc-embed"),
    vasInnerLen: vas?.innerHTML?.length || 0,
    canvasW: canvas?.width || 0,
    canvasH: canvas?.height || 0,
  };
});

console.log(JSON.stringify({ ok: true, iframeInfo, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
