const fs = require("fs");
const input = process.argv[2] || fs.readFileSync(require("path").join(__dirname, "page.html"), "utf8");
const m = String(input).match(/[?&]c=([^"&\s]+)/);
if (!m) {
  console.error("No c= param");
  process.exit(1);
}
const raw = decodeURIComponent(m[1]);
function decodeEmbedConfigPayload(raw) {
  return JSON.parse(decodeURIComponent(escape(Buffer.from(raw, "base64").toString("binary"))));
}
try {
  const config = decodeEmbedConfigPayload(raw);
  console.log("OK", JSON.stringify({ v: config.v, text: config.preset?.text, export: config.export }, null, 2));
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
}
