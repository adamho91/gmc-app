import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const failed = [];
page.on("requestfailed", (r) => failed.push(r.url()));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
});

await page.goto("http://127.0.0.1:8765/page.html", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
console.log("failed requests:", [...new Set(failed)].join("\n"));
await browser.close();
